'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type SessionActionsProps = {
  sessionId: string;
  status: string;
  deleteRedirect?: string;
  showComplete?: boolean;
};

export function SessionActions({ sessionId, status, deleteRedirect = '/interviews', showComplete = true }: SessionActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'complete' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const isActive = status === 'ACTIVE';

  const completeSession = async () => {
    setPendingAction('complete');
    setError('');
    try {
      const response = await fetch(`/api/interviews/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to end practice.');
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to end practice.');
    } finally {
      setPendingAction(null);
    }
  };

  const deleteSession = async () => {
    if (!window.confirm('Delete this interview session?')) return;
    setPendingAction('delete');
    setError('');
    try {
      const response = await fetch(`/api/interviews/${sessionId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete this session.');
      router.push(deleteRedirect);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to delete this session.');
      setPendingAction(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {isActive && showComplete && (
          <button type="button" className="btn-primary" onClick={completeSession} disabled={pendingAction !== null}>
            {pendingAction === 'complete' ? 'Ending Practice...' : 'End Practice'}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={deleteSession} disabled={pendingAction !== null}>
          {pendingAction === 'delete' ? 'Deleting...' : 'Delete Session'}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    </div>
  );
}
