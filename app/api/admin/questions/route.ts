import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';
import { questionCategories, questionDifficulties, questionExperienceLevels } from '@/lib/question-bank';

const schema = z.object({
  question: z.string().trim().min(8).max(3000),
  category: z.enum(questionCategories),
  difficulty: z.enum(questionDifficulties).nullable().optional(),
  experienceLevel: z.enum(questionExperienceLevels).nullable().optional(),
  technology: z.string().trim().max(100).nullable().optional(),
  jobRole: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  status: z.enum(['DRAFT','PUBLISHED','ARCHIVED']).optional().default('DRAFT'),
  isAiGenerated: z.boolean().optional().default(false),
}).strict();

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if (access.response) return access.response;
  if (!access.userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the question fields.' }, { status: 400 });
  try {
    const item = await prisma.$transaction(async (tx) => {
      const question = await tx.questionBankItem.create({ data: { ...parsed.data, userId: null } });
      await tx.adminAuditLog.create({ data: { actorId: access.userId!, action: 'QUESTION_CREATED', targetType: 'QuestionBankItem', targetId: question.id, details: { status: question.status, category: question.category, isAiGenerated: question.isAiGenerated } } });
      return question;
    });
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Unable to create this question.' }, { status: 500 }); }
}
