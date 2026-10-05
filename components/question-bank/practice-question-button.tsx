'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type PracticeQuestionButtonProps = {
  questionId: string;
  className?: string;
};

export function PracticeQuestionButton({ questionId, className = 'btn-primary' }: PracticeQuestionButtonProps) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');

  const openPractice = async () => {
    if (isOpening) return;
    setIsOpening(true);
    setError('');
    try {
      const response = await fetch(`/api/question-bank/${questionId}/practice`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open practice.');
      router.push(`/interviews/${result.sessionId}?questionId=${encodeURIComponent(questionId)}`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open practice.');
      setIsOpening(false);
    }
  };

  return <span className="inline-flex flex-col items-start gap-2"><button type="button" className={className} onClick={() => void openPractice()} disabled={isOpening}>{isOpening ? 'Opening...' : 'Practice with Genzz AI'}</button>{error && <span role="alert" className="text-xs text-rose-300">{error}</span>}</span>;
}
