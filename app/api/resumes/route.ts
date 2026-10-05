import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { detectResumeFile, extractResumeText } from '@/lib/resume-processing';
import { resumeStorage } from '@/lib/resume-storage';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function safeFileName(name: string) {
  const normalized = name.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return normalized.slice(0, 255) || 'resume';
}

async function readLimitedBody(request: Request) {
  if (!request.body) throw new Error('Choose a PDF or DOCX resume to upload.');
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_FILE_SIZE) {
        await reader.cancel();
        throw new RangeError('Resume must be smaller than 10 MB.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalSize);
}

export async function POST(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to upload a resume.' }, { status: 401 });
  }
  const uploadLimit = consumeRateLimit(`resume-upload:${authSession.user.id}`, 10, 60 * 60_000);
  if (!uploadLimit.allowed) return NextResponse.json({ error: 'Too many resume uploads. Try again later.' }, { status: 429, headers: { 'Retry-After': String(uploadLimit.retryAfterSeconds) } });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Resume must be smaller than 10 MB.' }, { status: 413 });
  }

  const encodedName = request.headers.get('x-file-name');
  let originalName: string;
  try {
    originalName = decodeURIComponent(encodedName || '');
  } catch {
    return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
  }
  if (!originalName || originalName.length > 1024) {
    return NextResponse.json({ error: 'Choose a PDF or DOCX resume to upload.' }, { status: 400 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readLimitedBody(request);
  } catch (error) {
    const tooLarge = error instanceof RangeError;
    return NextResponse.json(
      { error: tooLarge ? 'Resume must be smaller than 10 MB.' : 'Unable to read the uploaded file.' },
      { status: tooLarge ? 413 : 400 },
    );
  }
  if (fileBuffer.byteLength === 0) {
    return NextResponse.json({ error: 'Choose a PDF or DOCX resume to upload.' }, { status: 400 });
  }

  const mimeType = (request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  let extension: 'pdf' | 'docx';
  try {
    extension = detectResumeFile(fileBuffer, originalName, mimeType);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload a valid PDF or DOCX resume.' }, { status: 415 });
  }

  let storageKey: string | undefined;
  let resumeId: string | undefined;
  try {
    storageKey = await resumeStorage.upload(fileBuffer, extension);
    const resume = await prisma.resume.create({
      data: {
        userId: authSession.user.id,
        fileName: safeFileName(originalName),
        fileType: extension.toUpperCase(),
        mimeType: extension === 'pdf' ? 'application/pdf' : DOCX_MIME_TYPE,
        fileSize: fileBuffer.byteLength,
        storageKey,
        processingStatus: 'PROCESSING',
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        mimeType: true,
        fileSize: true,
        processingStatus: true,
        createdAt: true,
      },
    });
    resumeId = resume.id;

    try {
      const extractedText = await extractResumeText(fileBuffer, extension);
      const completed = await prisma.resume.update({
        where: { id: resume.id },
        data: { extractedText, processingStatus: 'COMPLETED' },
        select: { processingStatus: true },
      });
      await createNotification({ userId: authSession.user.id, type: 'RESUME_PROCESSED', category: 'RESUME', title: 'Your resume is ready', message: 'Your resume was processed and is ready to use in practice.', actionUrl: `/resumes/${resume.id}`, eventKey: `resume:${resume.id}:completed` }).catch(() => undefined);
      return NextResponse.json({
        resume: { ...resume, processingStatus: completed.processingStatus, createdAt: resume.createdAt.toISOString() },
      }, { status: 201 });
    } catch {
      const failed = await prisma.resume.update({
        where: { id: resume.id },
        data: { processingStatus: 'FAILED' },
        select: { processingStatus: true },
      });
      await createNotification({ userId: authSession.user.id, type: 'RESUME_PROCESSING_FAILED', category: 'RESUME', title: "We couldn't process your resume", message: 'Please try again with a supported, readable PDF or DOCX file.', actionUrl: `/resumes/${resume.id}`, eventKey: `resume:${resume.id}:failed` }).catch(() => undefined);
      return NextResponse.json({
        resume: { ...resume, processingStatus: failed.processingStatus, createdAt: resume.createdAt.toISOString() },
        warning: 'We could not extract text from this file. Check that it is a supported, readable PDF or DOCX.',
      }, { status: 201 });
    }
  } catch {
    if (resumeId) {
      await prisma.resume.updateMany({
        where: { id: resumeId, userId: authSession.user.id, processingStatus: 'PROCESSING' },
        data: { processingStatus: 'FAILED' },
      }).catch(() => undefined);
    } else if (storageKey) {
      await resumeStorage.delete(storageKey).catch(() => undefined);
    }
    return NextResponse.json({ error: 'Resume upload could not be completed. Please try again.' }, { status: 500 });
  }
}
