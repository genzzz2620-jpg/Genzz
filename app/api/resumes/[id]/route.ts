import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resumeStorage } from '@/lib/resume-storage';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to download this resume.' }, { status: 401 });
  }

  try {
    const resume = await prisma.resume.findFirst({
      where: { id: id, userId: authSession.user.id },
      select: { fileName: true, mimeType: true, storageKey: true },
    });
    if (!resume || !resume.storageKey) {
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 });
    }

    const file = await resumeStorage.get(resume.storageKey);
    const fallbackName = resume.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const encodedName = encodeURIComponent(resume.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': resume.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
        'Content-Length': String(file.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Resume file is currently unavailable.' }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to delete this resume.' }, { status: 401 });
  }

  try {
    const resume = await prisma.resume.findFirst({
      where: { id: id, userId: authSession.user.id },
      select: { id: true, storageKey: true },
    });
    if (!resume) return NextResponse.json({ error: 'Resume not found.' }, { status: 404 });

    await prisma.resume.delete({ where: { id: resume.id } });
    if (resume.storageKey) await resumeStorage.delete(resume.storageKey).catch(() => undefined);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete this resume right now.' }, { status: 500 });
  }
}
