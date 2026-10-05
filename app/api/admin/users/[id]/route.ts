import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({
  role: z.enum(['USER', 'ADMIN']).optional(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
}).strict().refine((data) => data.role !== undefined || data.accountStatus !== undefined, 'Choose an update.');

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdminApi();
  if (access.response) return access.response;
  if (!access.userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid update.' }, { status: 400 });
  if (id === access.userId && (parsed.data.role === 'USER' || parsed.data.accountStatus === 'SUSPENDED')) {
    return NextResponse.json({ error: 'You cannot remove your own admin access or suspend your own account.' }, { status: 409 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: id }, select: { id: true, role: true, accountStatus: true } });
      if (!target) return { missing: true as const };
      const demoting = target.role === 'ADMIN' && parsed.data.role === 'USER';
      const suspending = target.accountStatus === 'ACTIVE' && parsed.data.accountStatus === 'SUSPENDED';
      if (demoting || suspending) {
        const otherActiveAdmins = await tx.user.count({ where: { id: { not: target.id }, role: 'ADMIN', accountStatus: 'ACTIVE' } });
        if (otherActiveAdmins === 0) return { lastAdmin: true as const };
      }
      const updated = await tx.user.update({ where: { id: target.id }, data: parsed.data, select: { id: true, role: true, accountStatus: true } });
      if (updated.accountStatus === 'SUSPENDED' && target.accountStatus !== 'SUSPENDED') {
        await tx.desktopConnection.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date(), codeHash: null, codeExpiresAt: null, tokenHash: null, tokenExpiresAt: null } });
      }
      if (target.role !== updated.role) {
        await tx.adminAuditLog.create({ data: { actorId: access.userId!, action: 'USER_ROLE_CHANGED', targetType: 'User', targetId: target.id, details: { from: target.role, to: updated.role } } });
      }
      if (target.accountStatus !== updated.accountStatus) {
        await tx.adminAuditLog.create({ data: { actorId: access.userId!, action: updated.accountStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', targetType: 'User', targetId: target.id, details: { from: target.accountStatus, to: updated.accountStatus } } });
      }
      return { user: updated };
    });
    if ('missing' in result) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if ('lastAdmin' in result) return NextResponse.json({ error: 'Keep at least one active administrator.' }, { status: 409 });
    return NextResponse.json({ user: result.user });
  } catch {
    return NextResponse.json({ error: 'Unable to update this account.' }, { status: 500 });
  }
}
