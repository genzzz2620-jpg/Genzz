import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeCategory } from '@/lib/analytics/metrics';

export async function POST(_request: Request, { params }: { params: Promise<{ answerId: string }> }) {
  const { answerId } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to save this question.' }, { status: 401 });
  const answer = await prisma.interviewAnswer.findFirst({ where: { id: answerId, session: { userId: auth.user.id } }, select: { id: true, question: true, questionType: true, session: { select: { jobTitle: true, company: true, experience: true } } } });
  if (!answer) return NextResponse.json({ error: 'Practice question not found.' }, { status: 404 });
  const category = normalizeCategory(answer.questionType);
  const duplicate = await prisma.questionBankItem.findFirst({ where: { question: { equals: answer.question, mode: 'insensitive' }, category, OR: [{ userId: null }, { userId: auth.user.id }] }, select: { id: true } });
  if (duplicate) return NextResponse.json({ id: duplicate.id, duplicate: true });
  const item = await prisma.questionBankItem.create({ data: { userId: auth.user.id, question: answer.question, category, questionType: answer.questionType, jobRole: answer.session.jobTitle, company: answer.session.company === 'No company selected' ? null : answer.session.company, experienceLevel: answer.session.experience, explanation: 'Saved from your interview practice history.' }, select: { id: true } });
  return NextResponse.json({ id: item.id, duplicate: false }, { status: 201 });
}
