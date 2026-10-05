import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getAIProvider } from '@/lib/ai/provider';
import { enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { questionCategories } from '@/lib/question-bank';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';
const inputSchema = z.object({
  targetRole: z.string().trim().min(1).max(120), targetCompany: z.string().trim().max(120).optional().default(''),
  experienceLevel: z.string().trim().min(1).max(60), jobDescription: z.string().max(10000).optional().default(''),
  resumeId: z.string().cuid().nullable().optional(), durationDays: z.number().int().min(1).max(30), aiModel: z.enum(['ChatGPT', 'Gemini']).default('ChatGPT'), regeneratePlanId: z.string().cuid().optional(),
});
const outputSchema = z.object({ overview: z.string().min(1).max(1200), focusAreas: z.array(z.string().min(1).max(100)).min(1).max(8), technicalTopics: z.array(z.string().max(100)).max(12), behavioralTopics: z.array(z.string().max(100)).max(12), resumeTopics: z.array(z.string().max(100)).max(12), tasks: z.array(z.object({ day: z.number().int().min(1).max(30), title: z.string().min(3).max(140), description: z.string().max(500), category: z.enum(questionCategories), priority: z.enum(['HIGH','MEDIUM','LOW']), estimatedMinutes: z.number().int().min(5).max(180) })).min(1).max(90) });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const plans = await prisma.preparationPlan.findMany({ where: { userId: session.user.id, status: 'ACTIVE' }, select: { id: true }, orderBy: { updatedAt: 'desc' }, take: 1 });
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the plan details.' }, { status: 400 });
  const data = parsed.data;
  try {
    const [subscription, currentPlans] = await Promise.all([
      getCurrentSubscription(session.user.id), prisma.preparationPlan.count({ where: { userId: session.user.id, status: 'ACTIVE' } }),
    ]);
    const existingPlan = data.regeneratePlanId ? await prisma.preparationPlan.findFirst({ where: { id: data.regeneratePlanId, userId: session.user.id, status: 'ACTIVE' }, select: { id: true } }) : null;
    if (data.regeneratePlanId && !existingPlan) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    if (subscription.plan === 'FREE' && currentPlans >= 1 && !existingPlan) return NextResponse.json({ error: 'Free plans include one active preparation plan. Upgrade or complete your current plan.' }, { status: 403 });
    const resume = data.resumeId ? await prisma.resume.findFirst({ where: { id: data.resumeId, userId: session.user.id, processingStatus: 'COMPLETED' }, select: { extractedText: true } }) : null;
    if (data.resumeId && !resume) return NextResponse.json({ error: 'Selected resume is unavailable.' }, { status: 400 });
    await enforceAIRateLimit(session.user.id);
    const [sessions, answers, questions] = await Promise.all([
      prisma.interviewSession.findMany({ where: { userId: session.user.id }, select: { jobTitle: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      prisma.interviewAnswer.findMany({ where: { session: { userId: session.user.id } }, select: { questionType: true, analysisJson: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.questionBankItem.findMany({ where: { OR: [{ userId: null }, { userId: session.user.id }], status: 'PUBLISHED', jobRole: { contains: data.targetRole, mode: 'insensitive' } }, select: { question: true, category: true }, take: 12 }),
    ]);
    const model = data.aiModel;
    const usage = await prisma.aIUsage.create({ data: { userId: session.user.id, provider: model, model, feature: 'PREPARATION_PLAN', status: 'PENDING' }, select: { id: true } });
    try {
      const response = await getAIProvider(model).generateText({
        systemInstruction: 'Create a practical interview preparation recommendation. Do not invent candidate achievements, actual company interview questions, or guaranteed outcomes. Return only JSON matching the requested structure. Use only supplied context. Keep tasks actionable and distribute them across the requested days.',
        prompt: JSON.stringify({ role: data.targetRole, company: data.targetCompany || undefined, experience: data.experienceLevel, durationDays: data.durationDays, jobDescription: data.jobDescription.slice(0, 4000) || undefined, resumeContext: resume?.extractedText?.slice(0, 2400) || undefined, recentSessions: sessions, feedback: answers.filter((answer) => answer.analysisJson !== null).slice(0, 12).map((answer) => ({ type: answer.questionType, feedback: answer.analysisJson })), questionBank: questions, format: { overview: 'string', focusAreas: ['string'], technicalTopics: ['string'], behavioralTopics: ['string'], resumeTopics: ['string'], tasks: [{ day: 1, title: 'string', description: 'string', category: questionCategories.join('|'), priority: 'HIGH|MEDIUM|LOW', estimatedMinutes: 20 }] } }),
      });
      const json = response.text.match(/\{[\s\S]*\}/)?.[0];
      const candidate = json ? outputSchema.safeParse(JSON.parse(json)) : null;
      if (!candidate?.success) throw new Error('INVALID_PLAN');
      const planData = candidate.data;
      const days = [...planData.tasks].sort((a, b) => a.day - b.day);
      if (days.some((task) => task.day > data.durationDays)) throw new Error('INVALID_PLAN');
      const today = new Date(); today.setHours(0,0,0,0);
      const planFields = {
        userId: session.user.id, title: `${data.targetRole} preparation`, targetRole: data.targetRole, targetCompany: data.targetCompany || null,
        experienceLevel: data.experienceLevel, jobDescription: data.jobDescription || null, resumeId: data.resumeId || null, durationDays: data.durationDays,
        overview: planData.overview, focusAreas: planData.focusAreas, technicalTopics: planData.technicalTopics, behavioralTopics: planData.behavioralTopics, resumeTopics: planData.resumeTopics,
      };
      const taskRecords = days.map((task) => ({ userId: session.user.id, title: task.title, description: task.description, category: task.category, priority: task.priority, scheduledDate: new Date(today.getTime() + (task.day - 1) * 86400000), estimatedMinutes: task.estimatedMinutes }));
      let plan;
      if (existingPlan) {
        await prisma.$transaction(async (tx) => {
          await tx.preparationPlan.update({ where: { id: existingPlan.id }, data: planFields });
          await tx.preparationTask.deleteMany({ where: { planId: existingPlan.id, userId: session.user.id, status: { not: 'COMPLETED' } } });
          await tx.preparationTask.createMany({ data: taskRecords.map((task) => ({ ...task, planId: existingPlan.id })) });
        });
        plan = await prisma.preparationPlan.findUnique({ where: { id: existingPlan.id }, include: { tasks: { orderBy: { scheduledDate: 'asc' } } } });
      } else {
        plan = await prisma.preparationPlan.create({ data: { ...planFields, tasks: { create: taskRecords } }, include: { tasks: { orderBy: { scheduledDate: 'asc' } } } });
      }
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { model: response.model, inputTokens: response.inputTokens, outputTokens: response.outputTokens, status: 'SUCCESS' } });
      if (plan) await createNotification({ userId: session.user.id, type: 'PREPARATION_PLAN_UPDATED', category: 'PREPARATION', title: existingPlan ? 'Preparation plan updated' : "Today's preparation is ready", message: existingPlan ? 'Your preparation plan has been refreshed with new practice recommendations.' : 'Your preparation plan and practice tasks are ready.', actionUrl: '/preparation', eventKey: `preparation:${plan.id}:${plan.updatedAt.toISOString()}` }).catch(() => undefined);
      return NextResponse.json({ plan, notice: 'AI recommendations are practice guidance, not a guarantee. Company-focused prompts are not verified interview questions.' }, { status: existingPlan ? 200 : 201 });
    } catch (error) {
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { status: 'FAILED' } });
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('usage limit')) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    if (error instanceof Error && error.message === 'INVALID_PLAN') return NextResponse.json({ error: 'The generated plan was incomplete. Please try again.' }, { status: 502 });
    return NextResponse.json({ error: 'Unable to generate a plan right now. Please try again.' }, { status: 502 });
  }
}
