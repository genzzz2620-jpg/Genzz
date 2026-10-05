import { NextResponse } from 'next/server';
import { AIRateLimitError } from '@/lib/ai/rate-limit';
import { AIConfigurationError, AIProviderError } from '@/lib/ai/errors';

export function simulatorErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
  if (error instanceof AIConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof AIProviderError) {
    if (error.kind === 'RATE_LIMIT') return NextResponse.json({ error: 'The AI provider is busy. Wait briefly and retry.' }, { status: 429, headers: { 'Retry-After': '60' } });
    if (error.kind === 'TIMEOUT' || error.kind === 'UNAVAILABLE') return NextResponse.json({ error: 'The AI interviewer is temporarily unavailable. Retry to continue.' }, { status: 502 });
  }
  if (error instanceof Error && error.message === 'INVALID_AI_OUTPUT') return NextResponse.json({ error: 'The AI interviewer returned an unusable response. Retry this step.' }, { status: 502 });
  return NextResponse.json({ error: fallback }, { status: 502 });
}
