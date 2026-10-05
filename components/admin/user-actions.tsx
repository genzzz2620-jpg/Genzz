'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UserActions({ userId, name, role, accountStatus }: { userId: string; name: string; role: 'USER' | 'ADMIN'; accountStatus: 'ACTIVE' | 'SUSPENDED' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function update(change: { role?: 'USER' | 'ADMIN'; accountStatus?: 'ACTIVE' | 'SUSPENDED' }) {
    const grantingAdmin = change.role === 'ADMIN' && role !== 'ADMIN';
    const suspending = change.accountStatus === 'SUSPENDED';
    const operation = grantingAdmin ? 'Grant ADMIN access to' : suspending ? 'Suspend' : change.role ? 'Change role for' : 'Reactivate';
    if (!window.confirm(`${operation} ${name}?`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update this user.');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update this user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {accountStatus === 'ACTIVE' ? <button disabled={busy} onClick={() => void update({ accountStatus: 'SUSPENDED' })} className="rounded-md border border-rose-500/30 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">Suspend</button> : <button disabled={busy} onClick={() => void update({ accountStatus: 'ACTIVE' })} className="rounded-md border border-emerald-500/30 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">Reactivate</button>}
      <button disabled={busy} onClick={() => void update({ role: role === 'ADMIN' ? 'USER' : 'ADMIN' })} className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">{role === 'ADMIN' ? 'Make USER' : 'Grant ADMIN'}</button>
      {error && <span role="alert" className="w-full text-xs text-rose-300">{error}</span>}
    </div>
  );
}
