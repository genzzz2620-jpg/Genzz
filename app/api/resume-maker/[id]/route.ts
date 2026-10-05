import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/prisma/generated/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resumeContentSchema } from '@/lib/resume-maker';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ id: string }> };
const saveSchema = z.object({ title: z.string().trim().min(1).max(180), targetJobTitle: z.string().trim().max(180), targetCompany: z.string().trim().max(180), jobDescription: z.string().trim().max(12000), content: resumeContentSchema });

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to open this resume.' }, { status: 401 });
  const document = await prisma.resumeDocument.findFirst({ where: { id: id, userId: auth.user.id }, include: { versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, content: true, createdAt: true } } } });
  if (!document) return NextResponse.json({ error: 'Resume not found.' }, { status: 404 });
  return NextResponse.json({ document: { ...document, createdAt: document.createdAt.toISOString(), updatedAt: document.updatedAt.toISOString(), versions: document.versions.map(version => ({ ...version, createdAt: version.createdAt.toISOString() })) } }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to save this resume.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid resume data.' }, { status: 400 }); }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the resume details.' }, { status: 400 });
  const result = await prisma.$transaction(async tx => {
    const document = await tx.resumeDocument.findFirst({ where: { id: id, userId: auth.user!.id }, select: { id: true } });
    if (!document) return null;
    const last = await tx.resumeDocumentVersion.findFirst({ where: { documentId: document.id }, orderBy: { version: 'desc' }, select: { version: true } });
    const updated = await tx.resumeDocument.update({ where: { id: document.id }, data: { title: parsed.data.title, targetJobTitle: parsed.data.targetJobTitle, targetCompany: parsed.data.targetCompany, jobDescription: parsed.data.jobDescription } });
    const version = await tx.resumeDocumentVersion.create({ data: { documentId: document.id, version: (last?.version || 0) + 1, content: parsed.data.content as Prisma.InputJsonValue }, select: { id: true, version: true, createdAt: true } });
    return { updated, version };
  });
  if (!result) return NextResponse.json({ error: 'Resume not found.' }, { status: 404 });
  return NextResponse.json({ document: { id: result.updated.id, title: result.updated.title, updatedAt: result.updated.updatedAt.toISOString(), version: result.version.version, versionId: result.version.id, createdAt: result.version.createdAt.toISOString() } });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to delete this resume.' }, { status: 401 });
  const removed = await prisma.resumeDocument.deleteMany({ where: { id: id, userId: auth.user.id } });
  return removed.count ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: 'Resume not found.' }, { status: 404 });
}
