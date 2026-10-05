'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { emptyResumeContent, resumeSectionTitles, type ResumeContent, type ResumeSection } from '@/lib/resume-maker-data';

type Provider = 'ChatGPT' | 'Gemini';
type Version = { id: string; version: number; content: ResumeContent; createdAt: string };
type DocumentItem = { id: string; title: string; targetJobTitle: string; targetCompany: string; updatedAt: string; versionCount: number; latestVersion: { version: number; content: ResumeContent } | null };
type SourceResume = { id: string; fileName: string; fileType: string | null; createdAt: string };
type OptimizeReport = { relevantSkills: string[]; missingKeywords: string[]; summarySuggestion: string; bulletSuggestions: Array<{ section: 'experience' | 'projects' | 'achievements'; itemId: string; original: string; suggestion: string }>; keywordAlignment: string; formattingIssues: string[] };
type ApiState = 'idle' | 'loading' | 'saving' | 'error';
type TextSuggestion = { key: string; text: string; apply: (value: string) => void };
const fieldClass = 'input';
const boxClass = 'rounded-xl border border-slate-700 bg-slate-900/80 p-5';
const newId = () => globalThis.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The request could not be completed.');
  return data as T;
}

function Field({ label, value, onChange, placeholder, multiline = false, rows = 3, type = 'text', optional = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; rows?: number; type?: string; optional?: boolean }) {
  const shared = { value, placeholder, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), className: fieldClass, 'aria-label': label };
  return <label className="block text-sm text-slate-300">{label}{optional && <span className="ml-1 text-slate-500">(optional)</span>}{multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} type={type} />}</label>;
}

function NewEntryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="btn-secondary text-sm" onClick={onClick}>＋ {children}</button>;
}

export function ResumeMaker() {
  const [screen, setScreen] = useState<'home' | 'editor' | 'preview'>('home');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentPage, setDocumentPage] = useState(1);
  const [documentTotalPages, setDocumentTotalPages] = useState(1);
  const [loadingMoreDocuments, setLoadingMoreDocuments] = useState(false);
  const [sourceResumes, setSourceResumes] = useState<SourceResume[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [aiModel, setAiModel] = useState<Provider>('ChatGPT');
  const [documentId, setDocumentId] = useState('');
  const [sourceResumeId, setSourceResumeId] = useState('');
  const [title, setTitle] = useState('');
  const [targetJobTitle, setTargetJobTitle] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [content, setContent] = useState<ResumeContent>(emptyResumeContent());
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [importResumeId, setImportResumeId] = useState('');
  const [state, setState] = useState<ApiState>('loading');
  const [message, setMessage] = useState('');
  const [improving, setImproving] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<TextSuggestion | null>(null);
  const [bulletInputs, setBulletInputs] = useState<Record<string, string>>({});
  const [report, setReport] = useState<OptimizeReport | null>(null);
  const [loadingDocument, setLoadingDocument] = useState('');

  const refreshLibrary = useCallback(async (page = 1, append = false) => {
    const data = await readResponse<{ documents: DocumentItem[]; pagination: { page: number; totalPages: number }; sourceResumes: SourceResume[]; configuredProviders: Provider[] }>(await fetch(`/api/resume-maker?page=${page}&limit=20`, { cache: 'no-store' }));
    setDocuments(current => append ? [...current, ...data.documents.filter(item => !current.some(existing => existing.id === item.id))] : data.documents); setDocumentPage(data.pagination.page); setDocumentTotalPages(data.pagination.totalPages); setSourceResumes(data.sourceResumes); setProviders(data.configuredProviders);
    if (data.configuredProviders.length) setAiModel(current => data.configuredProviders.includes(current) ? current : data.configuredProviders[0]);
  }, []);
  useEffect(() => { void refreshLibrary().then(() => setState('idle')).catch(error => { setState('error'); setMessage(error instanceof Error ? error.message : 'Unable to load your resumes.'); }); }, [refreshLibrary]);

  const beginNew = () => {
    setDocumentId(''); setSourceResumeId(''); setTitle(''); setTargetJobTitle(''); setTargetCompany(''); setJobDescription(''); setContent(emptyResumeContent()); setVersions([]); setSelectedVersionId(''); setReport(null); setMessage(''); setScreen('editor');
  };
  const openDocument = async (id: string) => {
    setLoadingDocument(id); setMessage('');
    try {
      const data = await readResponse<{ document: { id: string; title: string; targetJobTitle: string; targetCompany: string; jobDescription: string; sourceResumeId: string | null; versions: Version[] } }>(await fetch(`/api/resume-maker/${id}`, { cache: 'no-store' }));
      const doc = data.document; setDocumentId(doc.id); setSourceResumeId(doc.sourceResumeId || ''); setTitle(doc.title); setTargetJobTitle(doc.targetJobTitle); setTargetCompany(doc.targetCompany); setJobDescription(doc.jobDescription); setVersions(doc.versions);
      setContent(doc.versions[0]?.content || emptyResumeContent()); setSelectedVersionId(doc.versions[0]?.id || ''); setReport(null); setScreen('editor');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open the resume.'); }
    finally { setLoadingDocument(''); }
  };
  const importExisting = async () => {
    if (!importResumeId || !providers.length) return;
    setState('loading'); setMessage('Importing resume details for review…');
    try {
      const data = await readResponse<{ content: ResumeContent; sourceResumeId: string; title: string }>(await fetch('/api/resume-maker/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId: importResumeId, aiModel }) }));
      setDocumentId(''); setSourceResumeId(data.sourceResumeId); setTitle(data.title); setTargetJobTitle(''); setTargetCompany(''); setJobDescription(''); setContent(data.content); setVersions([]); setSelectedVersionId(''); setReport(null); setMessage('Imported details are ready. Review and edit them before saving.'); setScreen('editor');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to import this resume.'); }
    finally { setState('idle'); }
  };
  const save = async () => {
    const email = content.personal.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage('Enter a valid email address, or leave the email field empty.'); return; }
    const phone = content.personal.phone.trim();
    if (phone && (!/^[+()\d.\-\s]+$/.test(phone) || (phone.match(/\d/g) || []).length < 7)) { setMessage('Check the phone number, or leave it empty.'); return; }
    const urls: Array<[string, string]> = [['LinkedIn', content.personal.linkedin], ['GitHub', content.personal.github], ['Portfolio', content.personal.portfolio], ...content.certifications.map(item => [`Credential URL (${item.name || 'certification'})`, item.credentialUrl] as [string, string])];
    for (const [label, value] of urls) {
      if (!value.trim()) continue;
      try { const url = new URL(value); if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(); }
      catch { setMessage(`${label} must be a valid http or https URL, or left empty.`); return; }
    }
    const cleanTitle = title.trim() || content.personal.fullName.trim() || targetJobTitle.trim() || 'Untitled Resume';
    setState('saving'); setMessage('');
    try {
      const body = { title: cleanTitle, targetJobTitle, targetCompany, jobDescription, content };
      if (!documentId) {
        const data = await readResponse<{ document: { id: string; title: string } }>(await fetch('/api/resume-maker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, sourceResumeId: sourceResumeId || undefined }) }));
        setDocumentId(data.document.id); setTitle(data.document.title); setMessage('Resume saved as version 1.');
      } else {
        const data = await readResponse<{ document: { version: number } }>(await fetch(`/api/resume-maker/${documentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
        setMessage(`Saved version ${data.document.version}.`);
      }
      await refreshLibrary();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save the resume.'); }
    finally { setState('idle'); }
  };
  const runImprove = async (field: 'summary' | 'bullet' | 'description' | 'achievement', text: string, context: string, apply: (value: string) => void, key: string) => {
    if (!text.trim() || !providers.length) return;
    setImproving(key); setMessage('');
    try {
      const data = await readResponse<{ text: string }>(await fetch('/api/resume-maker/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'improve', field, text, context, aiModel }) }));
      setAiSuggestion({ key, text: data.text, apply });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to improve this text.'); }
    finally { setImproving(''); }
  };
  const optimize = async () => {
    if (!providers.length) { setMessage('Configure ChatGPT or Gemini on the server to use AI resume tools.'); return; }
    setImproving('optimize'); setMessage('');
    try {
      const data = await readResponse<{ report: OptimizeReport }>(await fetch('/api/resume-maker/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'optimize', content, targetJobTitle, targetCompany, jobDescription, aiModel }) })); setReport(data.report);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to optimize this resume.'); }
    finally { setImproving(''); }
  };
  const setPersonal = (key: keyof ResumeContent['personal'], value: string) => setContent(current => ({ ...current, personal: { ...current.personal, [key]: value } }));
  const addEntry = (section: 'experience' | 'skills' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages') => {
    const entries: Record<typeof section, Record<string, string | boolean>> = {
      experience: { id: newId(), company: '', jobTitle: '', location: '', startDate: '', endDate: '', current: false, responsibilities: '', achievements: '', technologies: '' },
      skills: { id: newId(), category: '', skills: '' }, projects: { id: newId(), name: '', role: '', description: '', technologies: '', responsibilities: '', achievements: '' },
      education: { id: newId(), degree: '', institution: '', location: '', startYear: '', endYear: '', grade: '' }, certifications: { id: newId(), name: '', organization: '', date: '', credentialId: '', credentialUrl: '' },
      achievements: { id: newId(), name: '', description: '', date: '' }, languages: { id: newId(), name: '', proficiency: '' },
    };
    setContent(current => ({ ...current, [section]: [...current[section], entries[section]] } as ResumeContent));
  };
  const updateEntry = (section: 'experience' | 'skills' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages', index: number, field: string, value: string | boolean) => {
    setContent(current => ({ ...current, [section]: current[section].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) } as ResumeContent));
  };
  const moveEntry = (section: 'experience' | 'skills' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages', index: number, offset: number) => {
    setContent(current => {
      const items = [...current[section]], target = index + offset; if (target < 0 || target >= items.length) return current;
      [items[index], items[target]] = [items[target], items[index]]; return { ...current, [section]: items } as ResumeContent;
    });
  };
  const deleteEntry = (section: 'experience' | 'skills' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages', index: number) => setContent(current => ({ ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) } as ResumeContent));
  const moveSection = (index: number, offset: number) => setContent(current => {
    const order = [...current.sectionOrder], target = index + offset; if (target < 0 || target >= order.length) return current;
    [order[index], order[target]] = [order[target], order[index]]; return { ...current, sectionOrder: order };
  });
  const selectVersion = (id: string) => { const version = versions.find(item => item.id === id); if (version) { setSelectedVersionId(id); setContent(clone(version.content)); setMessage(`Loaded version ${version.version}. Save to create a new version.`); } };
  const listFields = (entries: Array<Record<string, string | boolean>>, section: 'experience' | 'skills' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages', fields: Array<{ key: string; label: string; multiline?: boolean; type?: string; optional?: boolean }>) => entries.map((entry, index) => {
    const id = String(entry.id);
    return <div key={id} className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-2"><strong className="text-white">{fields[0]?.label} {index + 1}</strong><div className="flex gap-1"><button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={index === 0} onClick={() => moveEntry(section, index, -1)} aria-label="Move entry up">↑</button><button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={index === entries.length - 1} onClick={() => moveEntry(section, index, 1)} aria-label="Move entry down">↓</button><button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => deleteEntry(section, index)}>Delete</button></div></div>
      <div className="grid gap-4 md:grid-cols-2">{fields.map(field => {
        if (section === 'experience' && field.key === 'current') return <label key={field.key} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={Boolean(entry.current)} onChange={event => updateEntry(section, index, 'current', event.target.checked)} /> Current job</label>;
        return <Field key={field.key} label={field.label} value={String(entry[field.key] || '')} onChange={value => updateEntry(section, index, field.key, value)} multiline={field.multiline} type={field.type} optional={field.optional} />;
      })}</div>
      {section === 'experience' && (() => {
        const fallbackBullet = String(entry.responsibilities || '').split('\n').find(line => line.trim()) || '';
        const bullet = bulletInputs[id] ?? fallbackBullet;
        return <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><Field label="Existing bullet to improve" value={bullet} onChange={value => setBulletInputs(current => ({ ...current, [id]: value }))} /><button type="button" className="btn-secondary text-xs" disabled={!bullet.trim() || improving === `experience-${id}`} onClick={() => void runImprove('bullet', bullet, `${entry.jobTitle} at ${entry.company}. Technologies: ${entry.technologies}. Target: ${targetJobTitle} ${jobDescription}`, value => {
          const responsibilities = String(entry.responsibilities || ''), achievements = String(entry.achievements || '');
          if (responsibilities.split('\n').some(line => line.trim() === bullet.trim())) updateEntry('experience', index, 'responsibilities', replaceLine(responsibilities, bullet, value));
          else if (achievements.split('\n').some(line => line.trim() === bullet.trim())) updateEntry('experience', index, 'achievements', replaceLine(achievements, bullet, value));
          setBulletInputs(current => ({ ...current, [id]: value }));
        }, `experience-${id}`)}>{improving === `experience-${id}` ? 'Improving…' : 'Improve Bullet'}</button></div>;
      })()}
      {section === 'projects' && <div className="mt-3 flex justify-end"><button type="button" className="btn-secondary text-xs" disabled={!String(entry.description || '').trim() || improving === `project-${id}`} onClick={() => void runImprove('description', String(entry.description || ''), `Project ${entry.name}; role ${entry.role}; technologies ${entry.technologies}`, value => updateEntry('projects', index, 'description', value), `project-${id}`)}>{improving === `project-${id}` ? 'Improving…' : 'Improve Description'}</button></div>}
    </div>;
  });

  const renderSection = (section: ResumeSection, orderIndex: number) => {
    const controls = <div className="flex gap-1"><button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={orderIndex === 0} onClick={() => moveSection(orderIndex, -1)} aria-label="Move section up">↑</button><button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={orderIndex === content.sectionOrder.length - 1} onClick={() => moveSection(orderIndex, 1)} aria-label="Move section down">↓</button></div>;
    const title = resumeSectionTitles[section];
    if (section === 'summary') return <section key={section} className={boxClass}><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div><Field label="Write a concise professional summary" value={content.summary} onChange={value => setContent(current => ({ ...current, summary: value }))} multiline rows={5} /><div className="mt-3 flex justify-end"><button type="button" className="btn-secondary" disabled={!content.summary.trim() || !providers.length || improving === 'summary'} onClick={() => void runImprove('summary', content.summary, `${targetJobTitle} ${targetCompany} ${jobDescription}`, value => setContent(current => ({ ...current, summary: value })), 'summary')}>{improving === 'summary' ? 'Improving…' : 'Improve with Genzz AI'}</button></div></section>;
    if (section === 'experience') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div>{listFields(content.experience as unknown as Array<Record<string, string | boolean>>, 'experience', [{ key: 'company', label: 'Company' }, { key: 'jobTitle', label: 'Job Title' }, { key: 'location', label: 'Location', optional: true }, { key: 'startDate', label: 'Start Date', type: 'month' }, { key: 'endDate', label: 'End Date', type: 'month', optional: true }, { key: 'current', label: 'Current Job' }, { key: 'responsibilities', label: 'Responsibilities (one per line)', multiline: true }, { key: 'achievements', label: 'Achievements (one per line)', multiline: true }, { key: 'technologies', label: 'Technologies', multiline: true, optional: true }])}<NewEntryButton onClick={() => addEntry('experience')}>Add Experience</NewEntryButton></section>;
    if (section === 'skills') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div><p className="text-sm text-slate-400">Add only skills you have actually used. Create any category you need.</p>{listFields(content.skills as unknown as Array<Record<string, string | boolean>>, 'skills', [{ key: 'category', label: 'Category' }, { key: 'skills', label: 'Skills (comma separated)', multiline: true }])}<NewEntryButton onClick={() => addEntry('skills')}>Add Skill Category</NewEntryButton></section>;
    if (section === 'projects') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div>{listFields(content.projects as unknown as Array<Record<string, string | boolean>>, 'projects', [{ key: 'name', label: 'Project Name' }, { key: 'role', label: 'Role' }, { key: 'description', label: 'Description', multiline: true }, { key: 'technologies', label: 'Technologies', multiline: true, optional: true }, { key: 'responsibilities', label: 'Responsibilities', multiline: true, optional: true }, { key: 'achievements', label: 'Achievements', multiline: true, optional: true }])}<NewEntryButton onClick={() => addEntry('projects')}>Add Project</NewEntryButton></section>;
    if (section === 'education') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div>{listFields(content.education as unknown as Array<Record<string, string | boolean>>, 'education', [{ key: 'degree', label: 'Degree' }, { key: 'institution', label: 'Institution' }, { key: 'location', label: 'Location', optional: true }, { key: 'startYear', label: 'Start Year', optional: true }, { key: 'endYear', label: 'End Year', optional: true }, { key: 'grade', label: 'Grade / CGPA', optional: true }])}<NewEntryButton onClick={() => addEntry('education')}>Add Education</NewEntryButton></section>;
    if (section === 'certifications') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div>{listFields(content.certifications as unknown as Array<Record<string, string | boolean>>, 'certifications', [{ key: 'name', label: 'Certification' }, { key: 'organization', label: 'Issuing Organization' }, { key: 'date', label: 'Date', optional: true }, { key: 'credentialId', label: 'Credential ID', optional: true }, { key: 'credentialUrl', label: 'Credential URL', optional: true }])}<NewEntryButton onClick={() => addEntry('certifications')}>Add Certification</NewEntryButton></section>;
    if (section === 'achievements') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div>{listFields(content.achievements as unknown as Array<Record<string, string | boolean>>, 'achievements', [{ key: 'name', label: 'Achievement' }, { key: 'date', label: 'Date', optional: true }, { key: 'description', label: 'Description', multiline: true }])}<NewEntryButton onClick={() => addEntry('achievements')}>Add Achievement</NewEntryButton></section>;
    if (section === 'languages') return <section key={section} className={`${boxClass} space-y-4`}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div>{listFields(content.languages as unknown as Array<Record<string, string | boolean>>, 'languages', [{ key: 'name', label: 'Language' }, { key: 'proficiency', label: 'Proficiency', optional: true }])}<NewEntryButton onClick={() => addEntry('languages')}>Add Language</NewEntryButton></section>;
    return <section key={section} className={boxClass}><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">{title}</h2>{controls}</div><Field label="Additional information" value={content.additionalInfo} onChange={value => setContent(current => ({ ...current, additionalInfo: value }))} multiline rows={4} optional /></section>;
  };

  const contact = [content.personal.email, content.personal.phone, content.personal.location, content.personal.linkedin, content.personal.github, content.personal.portfolio].filter(Boolean);
  const previewSection = (key: ResumeSection) => {
    const values: Record<string, ReactNode> = {
      summary: content.summary && <p className="whitespace-pre-line">{content.summary}</p>,
      experience: content.experience.filter(item => item.company || item.jobTitle).map(item => <div key={item.id} className="mb-4"><div className="font-semibold">{item.jobTitle}{item.jobTitle && item.company ? ' · ' : ''}{item.company}</div><div className="text-sm text-slate-500">{[item.location, item.startDate && `${item.startDate} – ${item.current ? 'Present' : item.endDate}`].filter(Boolean).join(' · ')}</div>{item.responsibilities && <p className="whitespace-pre-line">{item.responsibilities}</p>}{item.achievements && <p className="whitespace-pre-line">{item.achievements}</p>}{item.technologies && <div className="text-sm">Technologies: {item.technologies}</div>}</div>),
      skills: content.skills.filter(item => item.category || item.skills).map(item => <p key={item.id}><strong>{item.category}: </strong>{item.skills}</p>),
      projects: content.projects.filter(item => item.name || item.description).map(item => <div key={item.id} className="mb-3"><strong>{item.name}</strong>{item.role && ` · ${item.role}`}<p className="whitespace-pre-line">{item.description}</p>{[item.technologies, item.responsibilities, item.achievements].filter(Boolean).join('\n')}</div>),
      education: content.education.filter(item => item.degree || item.institution).map(item => <p key={item.id}><strong>{item.degree}</strong>{item.institution && ` · ${item.institution}`} {[item.location, item.startYear && `${item.startYear} – ${item.endYear}`, item.grade].filter(Boolean).join(' · ')}</p>),
      certifications: content.certifications.filter(item => item.name || item.organization).map(item => <p key={item.id}><strong>{item.name}</strong>{item.organization && ` · ${item.organization}`} {[item.date, item.credentialId, item.credentialUrl].filter(Boolean).join(' · ')}</p>),
      achievements: content.achievements.filter(item => item.name || item.description).map(item => <p key={item.id}><strong>{item.name}</strong>{item.date && ` · ${item.date}`}<br />{item.description}</p>),
      languages: content.languages.filter(item => item.name).map(item => <p key={item.id}>{item.name}{item.proficiency && ` · ${item.proficiency}`}</p>),
      additionalInfo: content.additionalInfo && <p className="whitespace-pre-line">{content.additionalInfo}</p>,
    };
    if (!values[key] || (Array.isArray(values[key]) && values[key].length === 0)) return null;
    return <section key={key} className="mb-5 break-inside-avoid"><h2 className="mb-2 border-b border-slate-300 pb-1 text-base font-bold uppercase tracking-wide">{resumeSectionTitles[key]}</h2><div className="space-y-1 text-sm leading-6">{values[key]}</div></section>;
  };

  return <div className="resume-maker space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Genzz AI</p><h1 className="mt-1 text-3xl font-bold text-white">Resume Maker</h1><p className="mt-2 text-slate-300">Build a clear, ATS-friendly resume grounded in your experience.</p></div>{screen !== 'home' && <button type="button" className="btn-secondary" onClick={() => setScreen('home')}>My Resumes</button>}</header>
    {message && <p role="status" className={`rounded-lg border p-3 text-sm ${state === 'error' ? 'border-rose-700 bg-rose-950/40 text-rose-200' : 'border-violet-700/60 bg-violet-950/30 text-slate-200'}`}>{message}</p>}

    {screen === 'home' && <>
      <section className="grid gap-4 md:grid-cols-3"><button type="button" className={`${boxClass} text-left hover:border-violet-400`} onClick={beginNew}><span className="text-sm text-violet-300">Start fresh</span><span className="mt-2 block text-xl font-semibold text-white">Create New Resume</span><span className="mt-2 block text-sm text-slate-400">Build and organize each section yourself.</span></button><button type="button" className={`${boxClass} text-left hover:border-violet-400`} onClick={() => document.getElementById('import-resume')?.scrollIntoView({ behavior: 'smooth' })}><span className="text-sm text-violet-300">Reuse your upload</span><span className="mt-2 block text-xl font-semibold text-white">Import Existing Resume</span><span className="mt-2 block text-sm text-slate-400">Structure a PDF or DOCX already in your Resume Library.</span></button><button type="button" className={`${boxClass} text-left hover:border-violet-400`} onClick={() => document.getElementById('my-resumes')?.scrollIntoView({ behavior: 'smooth' })}><span className="text-sm text-violet-300">Continue editing</span><span className="mt-2 block text-xl font-semibold text-white">My Resumes</span><span className="mt-2 block text-sm text-slate-400">Open saved resumes and their versions.</span></button></section>
      <section id="import-resume" className={`${boxClass} scroll-mt-6`}><div><h2 className="text-xl font-semibold text-white">Import Existing Resume</h2><p className="mt-1 text-sm text-slate-400">Uses a resume you have already uploaded. Extracted fields need your review before saving.</p></div>{sourceResumes.length ? <div className="mt-4 flex flex-wrap gap-3"><select className={fieldClass} value={importResumeId} onChange={event => setImportResumeId(event.target.value)}><option value="">Choose an uploaded resume</option>{sourceResumes.map(resume => <option key={resume.id} value={resume.id}>{resume.fileName} · {resume.fileType || 'File'}</option>)}</select><select className={fieldClass} value={aiModel} onChange={event => setAiModel(event.target.value as Provider)} disabled={!providers.length}>{providers.length ? providers.map(provider => <option key={provider} value={provider}>{provider}</option>) : <option value="ChatGPT">No AI provider configured</option>}</select><button type="button" className="btn-primary" disabled={!importResumeId || !providers.length || state === 'loading'} onClick={() => void importExisting()}>{state === 'loading' ? 'Importing…' : 'Import and Review'}</button></div> : <p className="mt-4 text-sm text-slate-400">No processed uploads available. Upload a PDF or DOCX in <Link className="text-violet-300 underline" href="/resumes">Resume Library</Link>, or create a new resume.</p>}</section>
      <section id="my-resumes" className={`${boxClass} scroll-mt-6`}><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">My Resumes</h2><p className="mt-1 text-sm text-slate-400">Each save creates a restorable version.</p></div><button type="button" className="btn-secondary" onClick={() => void refreshLibrary()}>Refresh</button></div>{documents.length ? <div className="mt-4 divide-y divide-slate-700">{documents.map(document => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-white">{document.title}</strong><p className="mt-1 text-sm text-slate-400">{[document.targetJobTitle, document.targetCompany, `${document.versionCount} version${document.versionCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')} · Updated {new Date(document.updatedAt).toLocaleDateString()}</p></div><button type="button" className="btn-secondary" disabled={loadingDocument === document.id} onClick={() => void openDocument(document.id)}>{loadingDocument === document.id ? 'Opening…' : 'Open'}</button></div>)}</div> : <p className="mt-4 text-sm text-slate-400">No saved resumes yet.</p>}{documentPage < documentTotalPages && <button type="button" className="btn-secondary mt-4" disabled={loadingMoreDocuments} onClick={async () => { setLoadingMoreDocuments(true); try { await refreshLibrary(documentPage + 1, true); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load more resumes.'); } finally { setLoadingMoreDocuments(false); } }}>{loadingMoreDocuments ? 'Loading…' : 'Load more resumes'}</button>}</section>
    </>}

    {screen === 'editor' && <>
      <section className={boxClass}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Resume Details</h2><p className="text-sm text-slate-400">Fields are optional unless you choose to include them.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setScreen('preview')}>Preview</button><button type="button" className="btn-primary" disabled={state === 'saving'} onClick={() => void save()}>{state === 'saving' ? 'Saving…' : documentId ? 'Save New Version' : 'Save Resume'}</button></div></div><div className="grid gap-4 md:grid-cols-2"><Field label="Resume title" value={title} onChange={setTitle} placeholder="My Software Engineer Resume" /><label className="block text-sm text-slate-300">AI provider<select className={fieldClass} value={aiModel} onChange={event => setAiModel(event.target.value as Provider)} disabled={!providers.length}>{providers.length ? providers.map(provider => <option key={provider} value={provider}>{provider}</option>) : <option value="ChatGPT">No AI provider configured</option>}</select></label><Field label="Target Job Title" value={targetJobTitle} onChange={setTargetJobTitle} optional /><Field label="Target Company" value={targetCompany} onChange={setTargetCompany} optional /><div className="md:col-span-2"><Field label="Job Description" value={jobDescription} onChange={setJobDescription} multiline rows={5} optional /></div></div><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className="btn-secondary" disabled={improving === 'optimize'} onClick={() => void optimize()}>{improving === 'optimize' ? 'Analyzing…' : 'Optimize Resume'}</button>{documentId && versions.length > 1 && <label className="flex items-center gap-2 text-sm text-slate-300">Version history<select className={fieldClass} value={selectedVersionId} onChange={event => selectVersion(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>Version {version.version} · {new Date(version.createdAt).toLocaleString()}</option>)}</select></label>}</div></section>
      <section className={boxClass}><h2 className="mb-4 text-lg font-semibold text-white">Personal Information</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Full Name" value={content.personal.fullName} onChange={value => setPersonal('fullName', value)} /><Field label="Email" type="email" value={content.personal.email} onChange={value => setPersonal('email', value)} optional /><Field label="Phone" type="tel" value={content.personal.phone} onChange={value => setPersonal('phone', value)} optional /><Field label="Location" value={content.personal.location} onChange={value => setPersonal('location', value)} optional /><Field label="LinkedIn" value={content.personal.linkedin} onChange={value => setPersonal('linkedin', value)} optional /><Field label="GitHub" value={content.personal.github} onChange={value => setPersonal('github', value)} optional /><Field label="Portfolio" value={content.personal.portfolio} onChange={value => setPersonal('portfolio', value)} optional /></div></section>
      {aiSuggestion && <section className={`${boxClass} border-violet-500/50`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">AI wording suggestion</h2><p className="mt-1 text-xs text-slate-400">Review it for accuracy before applying. Genzz AI is instructed to preserve your facts.</p></div><span className="text-xs text-slate-500">{aiSuggestion.key}</span></div><p className="mt-3 whitespace-pre-line text-sm text-slate-200">{aiSuggestion.text}</p><div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setAiSuggestion(null)}>Keep Current Text</button><button type="button" className="btn-primary" onClick={() => { aiSuggestion.apply(aiSuggestion.text); setAiSuggestion(null); }}>Apply Suggestion</button></div></section>}
      {content.sectionOrder.map((section, index) => renderSection(section, index))}
      <div className="flex flex-wrap justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setScreen('preview')}>Preview Resume</button><button type="button" className="btn-primary" disabled={state === 'saving'} onClick={() => void save()}>{state === 'saving' ? 'Saving…' : documentId ? 'Save New Version' : 'Save Resume'}</button></div>
      {report && <section className={boxClass}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Resume Optimization</h2><p className="mt-1 text-xs text-slate-400">Editorial suggestions only; no guaranteed ATS score or result.</p></div><button type="button" className="btn-secondary" onClick={() => setReport(null)}>Close</button></div><p className="mt-4 text-sm text-slate-200">{report.keywordAlignment}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="font-semibold text-white">Relevant skills in your resume</h3><p className="mt-1 text-sm text-slate-300">{report.relevantSkills.join(', ') || 'No specific skills identified.'}</p></div><div><h3 className="font-semibold text-white">Missing job keywords</h3><p className="mt-1 text-sm text-slate-300">{report.missingKeywords.join(', ') || 'No clear missing terms found.'}</p><p className="mt-1 text-xs text-slate-500">Review these terms and add them only if they accurately describe your experience.</p></div></div>{report.summarySuggestion && <div className="mt-4 rounded-lg border border-slate-700 p-4"><h3 className="font-semibold text-white">Suggested summary</h3><p className="mt-2 whitespace-pre-line text-sm text-slate-300">{report.summarySuggestion}</p><button type="button" className="btn-secondary mt-3 text-xs" onClick={() => setContent(current => ({ ...current, summary: report.summarySuggestion }))}>Use suggestion</button></div>}{report.bulletSuggestions.map((item, index) => <div key={`${item.itemId}-${index}`} className="mt-3 rounded-lg border border-slate-700 p-4"><p className="text-xs uppercase text-slate-500">{item.section}</p><p className="mt-2 text-sm text-slate-400">{item.original}</p><p className="mt-2 text-sm text-slate-200">{item.suggestion}</p><button type="button" className="btn-secondary mt-3 text-xs" onClick={() => {
        setContent(current => {
          if (item.section === 'experience') return { ...current, experience: current.experience.map(entry => entry.id !== item.itemId ? entry : entry.responsibilities.split('\n').some(line => line.trim() === item.original.trim()) ? { ...entry, responsibilities: replaceLine(entry.responsibilities, item.original, item.suggestion) } : { ...entry, achievements: replaceLine(entry.achievements, item.original, item.suggestion) }) };
          if (item.section === 'projects') return { ...current, projects: current.projects.map(entry => entry.id !== item.itemId ? entry : entry.responsibilities.split('\n').some(line => line.trim() === item.original.trim()) ? { ...entry, responsibilities: replaceLine(entry.responsibilities, item.original, item.suggestion) } : entry.achievements.split('\n').some(line => line.trim() === item.original.trim()) ? { ...entry, achievements: replaceLine(entry.achievements, item.original, item.suggestion) } : { ...entry, description: replaceLine(entry.description, item.original, item.suggestion) }) };
          return { ...current, achievements: current.achievements.map(entry => entry.id !== item.itemId ? entry : { ...entry, description: replaceLine(entry.description, item.original, item.suggestion) }) };
        });
      }}>Apply suggestion</button></div>)}{report.formattingIssues.length > 0 && <div className="mt-4"><h3 className="font-semibold text-white">Formatting suggestions</h3><ul className="mt-2 list-disc pl-5 text-sm text-slate-300">{report.formattingIssues.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}</section>}
    </>}

    {screen === 'preview' && <section className="resume-preview mx-auto max-w-4xl rounded-xl bg-white p-8 text-slate-900 shadow-xl md:p-12"><div className="no-print mb-6 flex flex-wrap justify-between gap-3"><button type="button" className="btn-secondary" onClick={() => setScreen('editor')}>Back to Editor</button><button type="button" className="btn-primary" onClick={() => window.print()}>Export PDF / Print</button></div><header className="mb-6 border-b-2 border-slate-800 pb-4 text-center"><h1 className="text-3xl font-bold">{content.personal.fullName || 'Your Name'}</h1><p className="mt-2 text-sm">{contact.join(' · ')}</p>{targetJobTitle && <p className="mt-2 text-sm text-slate-600">Target: {targetJobTitle}{targetCompany ? ` · ${targetCompany}` : ''}</p>}</header>{content.sectionOrder.map(previewSection)}<p className="no-print mt-8 text-center text-xs text-slate-500">For ATS readability, this preview uses a single-column layout, standard headings, and text-based formatting.</p></section>}
    {screen === 'preview' && <p className="text-center text-sm text-slate-400">Use your browser’s “Save as PDF” option in the print dialog. DOCX export is not available in the current architecture.</p>}
    <style jsx global>{`@media print { body { background:#fff !important; } body * { visibility:hidden !important; } .resume-preview,.resume-preview * { visibility:visible !important; } .resume-preview { position:absolute !important; inset:0 auto auto 0 !important; width:100% !important; max-width:none !important; margin:0 !important; padding:0.45in !important; border-radius:0 !important; box-shadow:none !important; color:#111827 !important; } .resume-preview h1,.resume-preview h2,.resume-preview strong { color:#111827 !important; } .resume-preview .no-print { display:none !important; } @page { size:letter; margin:0.35in; } }`}</style>
  </div>;
}

function replaceLine(value: string, original: string, suggestion: string) {
  const lines = value.split('\n'), index = lines.findIndex(line => line.trim() === original.trim());
  if (index < 0) return value;
  lines[index] = suggestion; return lines.join('\n');
}
