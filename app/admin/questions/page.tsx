import { AdminHeading, AdminPagination } from '@/components/admin/admin-ui';
import { QuestionAdmin } from '@/components/admin/question-admin';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminQuestionsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  q?: string; status?: string; page?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const q = (searchParams?.q || '').trim().slice(0, 150);
  const status = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(searchParams?.status || '') ? searchParams?.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' : undefined;
  const page = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const pageSize = 20;
  const where = { ...(status ? { status } : {}), ...(q ? { question: { contains: q, mode: 'insensitive' as const } } : {}) };
  const [questions, total] = await Promise.all([prisma.questionBankItem.findMany({
    where,
    select: { id: true, question: true, category: true, difficulty: true, experienceLevel: true, technology: true, jobRole: true, company: true, tags: true, status: true, isAiGenerated: true },
    orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
  }), prisma.questionBankItem.count({ where })]);
  const query = new URLSearchParams(); if (q) query.set('q', q); if (status) query.set('status', status);
  return <><AdminHeading title="Question Bank" description="Create and moderate questions. Draft and archived items stay out of the user-facing bank." />
    <form method="get" className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search question text" className="input max-w-md" /><select name="status" defaultValue={status || ''} className="input w-auto"><option value="">All statuses</option><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select><button className="btn-secondary">Filter</button></form>
    <QuestionAdmin questions={questions} /><AdminPagination page={page} pageSize={pageSize} total={total} basePath="/admin/questions" query={query.toString()} /></>;
}
