import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { questionExperienceLevels } from '@/lib/question-bank';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Please sign in to practice this question.' }, { status: 401 });

  try {
    const question = await prisma.questionBankItem.findFirst({
      where: { id: id, status: 'PUBLISHED', OR: [{ userId: null }, { userId: authSession.user.id }] },
      select: { id: true, company: true, jobRole: true, experienceLevel: true },
    });
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    const company = question.company || 'Practice';
    const jobTitle = question.jobRole || 'Interview Practice';
    const experience = questionExperienceLevels.find((value) => value === question.experienceLevel) || 'Fresher';
    let interviewSession = await prisma.interviewSession.findFirst({
      where: { userId: authSession.user.id, company, jobTitle, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!interviewSession) {
      interviewSession = await prisma.interviewSession.create({
        data: {
          userId: authSession.user.id,
          company,
          jobTitle,
          experience,
          language: 'English',
          answerLength: 'Balanced',
          answerFormat: 'Normal',
          tone: 'Professional',
          aiModel: 'ChatGPT',
          technicalDepth: 'STANDARD',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    }

    return NextResponse.json({ sessionId: interviewSession.id, questionId: question.id });
  } catch {
    return NextResponse.json({ error: 'Unable to open a practice session right now.' }, { status: 500 });
  }
}
