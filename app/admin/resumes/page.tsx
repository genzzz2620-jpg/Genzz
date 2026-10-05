import Link from 'next/link';
import { AdminHeading, AdminTable, dateLabel, AdminEmpty } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminResumesPage() {
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const [uploads, documents] = await Promise.all([
    prisma.resume.findMany({ select: { id: true, fileName: true, processingStatus: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { updatedAt: 'desc' }, take: 150 }),
    prisma.resumeDocument.findMany({ select: { id: true, title: true, targetJobTitle: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { updatedAt: 'desc' }, take: 150 }),
  ]);
  const rows = [
    ...uploads.map((resume) => ({ id: `upload-${resume.id}`, user: resume.user, name: resume.fileName, target: '—', created: resume.createdAt, updated: resume.updatedAt, status: resume.processingStatus, kind: 'Uploaded Resume' })),
    ...documents.map((resume) => ({ id: `maker-${resume.id}`, user: resume.user, name: resume.title, target: resume.targetJobTitle || '—', created: resume.createdAt, updated: resume.updatedAt, status: 'SAVED', kind: 'Resume Maker' })),
  ].sort((a, b) => b.updated.getTime() - a.updated.getTime()).slice(0, 250);
  return <>
    <AdminHeading title="Resumes" description="Operational metadata only. Resume body and extracted document text are excluded from this list." />
    {rows.length ? <AdminTable headers={['User', 'Resume Name', 'Type', 'Target Job', 'Created', 'Updated', 'Processing Status']}>
      {rows.map((row) => <tr key={row.id}><td className="px-4 py-3"><Link href={`/admin/users/${row.user.id}`} className="font-medium text-white hover:text-violet-200">{row.user.name}</Link><p className="text-xs text-slate-500">{row.user.email}</p></td><td className="max-w-xs truncate px-4 py-3">{row.name}</td><td className="px-4 py-3 text-slate-400">{row.kind}</td><td className="px-4 py-3 text-slate-300">{row.target}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(row.created)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(row.updated)}</td><td className="px-4 py-3">{row.status}</td></tr>)}
    </AdminTable> : <AdminEmpty>No resumes have been created or uploaded.</AdminEmpty>}
    <p className="mt-3 text-xs text-slate-500">Showing up to 250 most recently updated items. Use user details for account context.</p>
  </>;
}
