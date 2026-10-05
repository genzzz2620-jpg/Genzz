import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { questionCategories } from '@/lib/question-bank';

const statusSchema = z.object({ id: z.string().cuid(), status: z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED','SKIPPED']) });
const createSchema = z.object({ planId: z.string().cuid(), title: z.string().trim().min(1).max(140), description: z.string().max(500).optional().default(''), category: z.enum(questionCategories), priority: z.enum(['HIGH','MEDIUM','LOW']).default('MEDIUM'), date: z.string().datetime().optional(), estimatedMinutes: z.number().int().min(5).max(180).default(20) });
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid task.' }, { status: 400 });
  const plan = await prisma.preparationPlan.findFirst({ where: { id: parsed.data.planId, userId: session.user.id, status: 'ACTIVE' }, select: { id: true } });
  if (!plan) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  const { planId, date, ...fields } = parsed.data;
  const task = await prisma.preparationTask.create({ data: { ...fields, planId, userId: session.user.id, scheduledDate: date ? new Date(date) : new Date() } });
  return NextResponse.json({ task }, { status: 201 });
}
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = statusSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Invalid task status.' }, { status: 400 });
  const result = await prisma.preparationTask.updateMany({ where: { id: parsed.data.id, userId: session.user.id }, data: { status: parsed.data.status } });
  if (!result.count) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
