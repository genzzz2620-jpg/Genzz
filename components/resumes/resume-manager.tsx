'use client';

import Link from 'next/link';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';

type ResumeItem = {
  id: string;
  fileName: string;
  fileType: string | null;
  mimeType: string | null;
  fileSize: number | null;
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
};

type ResumeManagerProps = {
  initialResumes: ResumeItem[];
  returnTo?: string;
};

type UploadState = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function formatSize(size: number | null) {
  if (size === null) return 'Size unavailable';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeManager({ initialResumes, returnTo }: ResumeManagerProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState(initialResumes);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [busyResumeId, setBusyResumeId] = useState('');
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const chooseFile = (file: File | undefined) => {
    setUploadMessage('');
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    const allowedType = (extension === 'pdf' && file.type === 'application/pdf') || (extension === 'docx' && file.type === DOCX_MIME_TYPE);
    if (!allowedType) {
      setSelectedFile(null);
      setUploadState('failed');
      setUploadMessage('Choose a PDF or DOCX file. Other file types are not supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setUploadState('failed');
      setUploadMessage('Resume must be smaller than 10 MB.');
      return;
    }
    if (file.size === 0) {
      setSelectedFile(null);
      setUploadState('failed');
      setUploadMessage('The selected file is empty.');
      return;
    }
    setSelectedFile(file);
    setUploadProgress(0);
    setUploadState('idle');
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const upload = () => {
    if (!selectedFile || uploadState === 'uploading' || uploadState === 'processing') return;
    setUploadState('uploading');
    setUploadProgress(0);
    setUploadMessage('');

    const request = new XMLHttpRequest();
    request.open('POST', '/api/resumes');
    request.setRequestHeader('Content-Type', selectedFile.type);
    request.setRequestHeader('X-File-Name', encodeURIComponent(selectedFile.name));
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      setUploadProgress(percent);
      if (percent === 100) setUploadState('processing');
    };
    request.upload.onload = () => setUploadState('processing');
    request.onerror = () => {
      setUploadState('failed');
      setUploadMessage('Upload could not be completed. Check your connection and try again.');
    };
    request.onload = () => {
      let result: { error?: string; warning?: string; resume?: ResumeItem } = {};
      try {
        result = JSON.parse(request.responseText);
      } catch {
        setUploadState('failed');
        setUploadMessage('The server returned an invalid response. Please try again.');
        return;
      }
      if (request.status < 200 || request.status >= 300 || !result.resume) {
        setUploadState('failed');
        setUploadMessage(result.error || 'Resume upload failed. Please try again.');
        return;
      }

      setResumes((current) => [result.resume!, ...current.filter((resume) => resume.id !== result.resume!.id)]);
      setUploadProgress(100);
      if (result.resume.processingStatus === 'COMPLETED') {
        setUploadState('completed');
        setUploadMessage('Resume processed successfully.');
      } else {
        setUploadState('failed');
        setUploadMessage(result.warning || 'The file was uploaded, but text extraction failed. Retry processing below.');
      }
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = '';
      router.refresh();
    };
    request.send(selectedFile);
  };

  const deleteResume = async (resume: ResumeItem) => {
    if (!window.confirm('Delete this resume?')) return;
    setBusyResumeId(resume.id);
    setActionErrors((current) => ({ ...current, [resume.id]: '' }));
    try {
      const response = await fetch(`/api/resumes/${resume.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete this resume.');
      setResumes((current) => current.filter((item) => item.id !== resume.id));
      router.refresh();
    } catch (error) {
      setActionErrors((current) => ({ ...current, [resume.id]: error instanceof Error ? error.message : 'Unable to delete this resume.' }));
    } finally {
      setBusyResumeId('');
    }
  };

  const retryProcessing = async (resume: ResumeItem) => {
    setBusyResumeId(resume.id);
    setActionErrors((current) => ({ ...current, [resume.id]: '' }));
    setResumes((current) => current.map((item) => item.id === resume.id ? { ...item, processingStatus: 'PROCESSING' } : item));
    try {
      const response = await fetch(`/api/resumes/${resume.id}/process`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Resume processing failed.');
      setResumes((current) => current.map((item) => item.id === resume.id ? { ...item, processingStatus: 'COMPLETED' } : item));
      router.refresh();
    } catch (error) {
      setResumes((current) => current.map((item) => item.id === resume.id ? { ...item, processingStatus: 'FAILED' } : item));
      setActionErrors((current) => ({ ...current, [resume.id]: error instanceof Error ? error.message : 'Resume processing failed.' }));
    } finally {
      setBusyResumeId('');
    }
  };

  const uploadBusy = uploadState === 'uploading' || uploadState === 'processing';

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Resume library</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Upload Resume</h1>
            <p className="mt-2 text-sm text-slate-300">PDF or DOCX · Maximum file size 10 MB. DOC files are not supported.</p>
          </div>
          {returnTo && <Link href={returnTo} className="btn-secondary">Continue setup</Link>}
        </div>

        <div
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-lg border border-dashed p-7 text-center transition ${isDragging ? 'border-violet-400 bg-violet-500/10' : 'border-slate-600 bg-slate-950/40'}`}
        >
          <input ref={fileInput} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileInput} className="sr-only" />
          <p className="text-base font-medium text-white">Drag and drop a resume here</p>
          <p className="my-2 text-sm text-slate-400">or</p>
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>Browse Files</button>
          {selectedFile && (
            <div className="mx-auto mt-5 max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-4 text-left">
              <p className="break-all font-medium text-white">{selectedFile.name}</p>
              <p className="mt-1 text-sm text-slate-400">{formatSize(selectedFile.size)} · {selectedFile.name.split('.').pop()?.toUpperCase()}</p>
              {!uploadBusy && <button type="button" className="btn-primary mt-4 w-full" onClick={upload}>Upload Resume</button>}
            </div>
          )}
          {uploadBusy && (
            <div className="mx-auto mt-5 max-w-lg text-left" aria-live="polite">
              <div className="flex justify-between text-sm text-slate-200"><span>{uploadState === 'processing' ? 'Processing Resume...' : 'Uploading...'}</span><span>{uploadProgress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${uploadProgress}%` }} /></div>
            </div>
          )}
          {uploadMessage && (
            <p role={uploadState === 'failed' ? 'alert' : 'status'} className={`mx-auto mt-4 max-w-lg text-sm ${uploadState === 'failed' ? 'text-rose-300' : 'text-emerald-300'}`}>
              {uploadState === 'completed' ? '✓ ' : ''}{uploadMessage}
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-xl font-semibold text-white">Your Resumes</h2><p className="mt-1 text-sm text-slate-400">Files are private to your account.</p></div>
          <span className="text-sm text-slate-400">{resumes.length} {resumes.length === 1 ? 'file' : 'files'}</span>
        </div>
        {resumes.length ? (
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-800 text-slate-300"><tr><th className="px-4 py-3">Filename</th><th className="px-4 py-3">Type · Size</th><th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody>
                {resumes.map((resume) => (
                  <tr key={resume.id} className="border-t border-slate-700 align-top">
                    <td className="max-w-xs break-all px-4 py-3 font-medium text-white">{resume.fileName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{resume.fileType || 'Unknown'} · {formatSize(resume.fileSize)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{new Date(resume.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs ${resume.processingStatus === 'COMPLETED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : resume.processingStatus === 'FAILED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{resume.processingStatus}</span></td>
                    <td className="min-w-48 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/resumes/${resume.id}`} className="btn-secondary text-xs">View</Link>
                        {resume.processingStatus === 'FAILED' && <button type="button" className="btn-secondary text-xs" disabled={busyResumeId === resume.id} onClick={() => retryProcessing(resume)}>{busyResumeId === resume.id ? 'Processing...' : 'Retry Processing'}</button>}
                        <button type="button" className="btn-secondary text-xs" disabled={busyResumeId === resume.id} onClick={() => deleteResume(resume)}>{busyResumeId === resume.id ? 'Working...' : 'Delete'}</button>
                      </div>
                      {actionErrors[resume.id] && <p role="alert" className="mt-2 text-xs text-rose-300">{actionErrors[resume.id]}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-slate-600 bg-slate-950/40 p-8 text-center text-slate-400">No resumes uploaded yet.</div>
        )}
      </section>
    </div>
  );
}
