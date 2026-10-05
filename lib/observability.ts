import 'server-only';

export function recordProviderMetric(input: { provider: 'openai' | 'gemini'; model: string; startedAt: number; outcome: 'success' | 'failure'; errorType?: string }) {
  const event = {
    event: 'ai.provider_request',
    provider: input.provider,
    model: input.model,
    outcome: input.outcome,
    latencyMs: Math.max(0, Date.now() - input.startedAt),
    ...(input.errorType ? { errorType: input.errorType } : {}),
  };
  (input.outcome === 'success' ? console.info : console.warn)(JSON.stringify(event));
}
