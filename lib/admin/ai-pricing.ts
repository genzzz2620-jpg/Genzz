export type MeteredProvider = 'OPENAI' | 'GEMINI';

function readRate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

export const estimatedAiRates = {
  OPENAI: {
    inputPerMillionUsd: readRate(process.env.AI_OPENAI_INPUT_USD_PER_MILLION),
    outputPerMillionUsd: readRate(process.env.AI_OPENAI_OUTPUT_USD_PER_MILLION),
  },
  GEMINI: {
    inputPerMillionUsd: readRate(process.env.AI_GEMINI_INPUT_USD_PER_MILLION),
    outputPerMillionUsd: readRate(process.env.AI_GEMINI_OUTPUT_USD_PER_MILLION),
  },
};

export function providerForUsage(value: string): MeteredProvider | null {
  const provider = value.toUpperCase();
  if (provider.includes('OPENAI') || provider.includes('CHATGPT')) return 'OPENAI';
  if (provider.includes('GEMINI') || provider.includes('GOOGLE')) return 'GEMINI';
  return null;
}

export function estimateUsageCost(provider: string, inputTokens: number | null, outputTokens: number | null): number | null {
  const key = providerForUsage(provider);
  if (!key || inputTokens === null || outputTokens === null) return null;
  const rates = estimatedAiRates[key];
  if (rates.inputPerMillionUsd === null || rates.outputPerMillionUsd === null) return null;
  return inputTokens * rates.inputPerMillionUsd / 1_000_000 + outputTokens * rates.outputPerMillionUsd / 1_000_000;
}
