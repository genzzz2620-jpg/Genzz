import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractResumeText } from '@/lib/resume-processing';
import { resumeStorage, type ResumeExtension } from '@/lib/resume-storage';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to retry processing.' }, { status: 401 });
  }
  const limit = consumeRateLimit(`resume-process:${authSession.user.id}`, 5, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many resume processing attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });

  try {
    const resume = await prisma.resume.findFirst({
      where: { id: id, userId: authSession.user.id },
      select: { id: true, storageKey: true, fileType: true, processingStatus: true },
    });
    if (!resume || !resume.storageKey) {
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 });
    }
    if (resume.processingStatus !== 'FAILED') {
      return NextResponse.json({ error: 'Only failed resume processing can be retried.' }, { status: 409 });
    }

    const claimed = await prisma.resume.updateMany({
      where: { id: resume.id, userId: authSession.user.id, processingStatus: 'FAILED' },
      data: { processingStatus: 'PROCESSING' },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Resume processing is already underway.' }, { status: 409 });
    }

    try {
      const buffer = await resumeStorage.get(resume.storageKey);
      const extension = resume.fileType?.toLowerCase() as ResumeExtension | undefined;
      if (extension !== 'pdf' && extension !== 'docx') throw new Error('This resume file type cannot be processed.');
      const extractedText = await extractResumeText(buffer, extension);
      await prisma.resume.update({
        where: { id: resume.id },
        data: { extractedText, processingStatus: 'COMPLETED' },
      });
      await createNotification({ userId: authSession.user.id, type: 'RESUME_PROCESSED', category: 'RESUME', title: 'Your resume is ready', message: 'Your resume was processed and is ready to use in practice.', actionUrl: `/resumes/${resume.id}`, eventKey: `resume:${resume.id}:completed` }).catch(() => undefined);
      return NextResponse.json({ processingStatus: 'COMPLETED' });
    } catch {
      await prisma.resume.update({ where: { id: resume.id }, data: { processingStatus: 'FAILED' } });
      await createNotification({ userId: authSession.user.id, type: 'RESUME_PROCESSING_FAILED', category: 'RESUME', title: "We couldn't process your resume", message: 'Please try again with a supported, readable PDF or DOCX file.', actionUrl: `/resumes/${resume.id}`, eventKey: `resume:${resume.id}:failed` }).catch(() => undefined);
      return NextResponse.json({
        error: 'Resume processing failed. Check that it is a supported, readable PDF or DOCX.',
      }, { status: 422 });
    }
  } catch {
    return NextResponse.json({ error: 'Unable to retry resume processing right now.' }, { status: 500 });
  }
}
