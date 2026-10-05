import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';
import { questionCategories, questionDifficulties, questionExperienceLevels } from '@/lib/question-bank';

const schema = z.object({
  question: z.string().trim().min(8).max(3000), category: z.enum(questionCategories),
  difficulty: z.preprocess((v) => v === '' ? null : v, z.enum(questionDifficulties).nullable().optional()),
  experienceLevel: z.preprocess((v) => v === '' ? null : v, z.enum(questionExperienceLevels).nullable().optional()),
  technology: z.string().trim().max(100).optional(), jobRole: z.string().trim().max(120).optional(), company: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20), status: z.enum(['DRAFT','PUBLISHED','ARCHIVED']), isAiGenerated: z.boolean(),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdminApi();
  if (access.response) return access.response;
  if (!access.userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the question fields.' }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const old = await tx.questionBankItem.findUnique({ where: { id: id }, select: { status: true, category: true } });
      if (!old) return null;
      const question = await tx.questionBankItem.update({ where: { id: id }, data: parsed.data });
      await tx.adminAuditLog.create({ data: { actorId: access.userId!, action: 'QUESTION_UPDATED', targetType: 'QuestionBankItem', targetId: question.id, details: { statusFrom: old.status, statusTo: question.status, categoryFrom: old.category, categoryTo: question.category } } });
      return question;
    });
    if (!updated) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch { return NextResponse.json({ error: 'Unable to update this question.' }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdminApi();
  if (access.response) return access.response;
  if (!access.userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const removed = await prisma.$transaction(async (tx) => {
      const question = await tx.questionBankItem.findUnique({ where: { id: id }, select: { id: true, category: true, status: true } });
      if (!question) return false;
      await tx.questionBankItem.delete({ where: { id: id } });
      await tx.adminAuditLog.create({ data: { actorId: access.userId!, action: 'QUESTION_DELETED', targetType: 'QuestionBankItem', targetId: question.id, details: { category: question.category, status: question.status } } });
      return true;
    });
    if (!removed) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch { return NextResponse.json({ error: 'Unable to delete this question.' }, { status: 500 }); }
}
