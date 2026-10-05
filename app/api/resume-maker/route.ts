import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resumeContentSchema } from '@/lib/resume-maker';

export const runtime = 'nodejs';
const documentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  targetJobTitle: z.string().trim().max(180).default(''),
  targetCompany: z.string().trim().max(180).default(''),
  jobDescription: z.string().trim().max(12000).default(''),
  content: resumeContentSchema,
  sourceResumeId: z.string().cuid().optional(),
});

export async function GET(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to access your resumes.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page') || '1');
  const pageSize = Number(params.get('limit') || '20');
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) return NextResponse.json({ error: 'Choose a valid page and limit (1–50).' }, { status: 400 });
  const where = { userId: auth.user.id };
  const [documents, total, sourceResumes] = await Promise.all([
    prisma.resumeDocument.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, content: true, createdAt: true } }, _count: { select: { versions: true } } } }),
    prisma.resumeDocument.count({ where }),
    prisma.resume.findMany({ where: { userId: auth.user.id, processingStatus: 'COMPLETED', extractedText: { not: null } }, select: { id: true, fileName: true, fileType: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 }),
  ]);
  const configuredProviders = [...(process.env.OPENAI_API_KEY ? ['ChatGPT'] : []), ...(process.env.GEMINI_API_KEY ? ['Gemini'] : [])];
  return NextResponse.json({ documents: documents.map(({ versions, _count, ...doc }) => ({ ...doc, updatedAt: doc.updatedAt.toISOString(), createdAt: doc.createdAt.toISOString(), versionCount: _count.versions, latestVersion: versions[0] ? { ...versions[0], createdAt: versions[0].createdAt.toISOString() } : null })), pagination: { page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }, sourceResumes: sourceResumes.map(resume => ({ ...resume, createdAt: resume.createdAt.toISOString() })), configuredProviders }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to save a resume.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid resume data.' }, { status: 400 }); }
  const parsed = documentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the resume details.' }, { status: 400 });
  if (parsed.data.sourceResumeId) {
    const source = await prisma.resume.findFirst({ where: { id: parsed.data.sourceResumeId, userId: auth.user.id, processingStatus: 'COMPLETED' }, select: { id: true } });
    if (!source) return NextResponse.json({ error: 'The selected uploaded resume is unavailable.' }, { status: 404 });
  }
  const created = await prisma.resumeDocument.create({ data: {
    userId: auth.user.id, sourceResumeId: parsed.data.sourceResumeId || null, title: parsed.data.title,
    targetJobTitle: parsed.data.targetJobTitle, targetCompany: parsed.data.targetCompany, jobDescription: parsed.data.jobDescription,
    versions: { create: { version: 1, content: parsed.data.content } },
  }, select: { id: true, title: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ document: { ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString(), versionCount: 1 } }, { status: 201 });
}
