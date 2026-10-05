import 'server-only';

import { GoogleGenAI } from '@google/genai';
import type { AIProvider, AIProviderRequest, AIProviderResponse } from './types';
import { AIConfigurationError, AIProviderError } from './errors';
import { recordProviderMetric } from '@/lib/observability';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI | null = null;
  private clientApiKey = '';

  private getClient(apiKey: string) {
    if (!this.client || this.clientApiKey !== apiKey) {
      this.clientApiKey = apiKey;
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async generateText(request: AIProviderRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIConfigurationError('Gemini is not configured on this server.');
    }

    const client = this.getClient(apiKey);
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    let response;
    const startedAt = Date.now();
    try {
      response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: 0.6,
          maxOutputTokens: 1200,
          httpOptions: { timeout: 45_000, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2, jitter: 0.2, httpStatusCodes: [408, 429, 500, 502, 503, 504] } },
        },
      });
    } catch (error) {
      recordProviderMetric({ provider: 'gemini', model, startedAt, outcome: 'failure', errorType: error instanceof Error ? error.name : 'UnknownError' });
      const providerError = error as { status?: number; code?: string | number; message?: string; name?: string };
      if (providerError.status === 429) throw new AIProviderError('RATE_LIMIT');
      if (/timeout/i.test(providerError.name || '') || /timeout/i.test(providerError.message || '')) throw new AIProviderError('TIMEOUT');
      if (providerError.status === 400 && /context|token|too long/i.test(providerError.message || '')) throw new AIProviderError('CONTEXT');
      throw new AIProviderError('UNAVAILABLE');
    }

    recordProviderMetric({ provider: 'gemini', model: response.modelVersion || model, startedAt, outcome: 'success' });

    const answer = response.text;
    if (!answer?.trim()) throw new AIProviderError('INVALID_RESPONSE');
    const result: AIProviderResponse = {
      text: answer.trim(),
      model: response.modelVersion || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    };
    return result;
  }

  async streamText(request: AIProviderRequest, onToken: (token: string) => void, signal?: AbortSignal) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIConfigurationError('Gemini is not configured on this server.');
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const client = this.getClient(apiKey);
    const startedAt = Date.now();
    try {
      const stream = await client.models.generateContentStream({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          temperature: 0.6,
          maxOutputTokens: 1200,
          abortSignal: signal,
          httpOptions: { timeout: 45_000, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2, jitter: 0.2, httpStatusCodes: [408, 429, 500, 502, 503, 504] } },
        },
      });
      let text = '';
      let responseModel = model;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      for await (const part of stream) {
        if (part.modelVersion) responseModel = part.modelVersion;
        if (part.usageMetadata) {
          inputTokens = part.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = part.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
        const token = part.text;
        if (token) { text += token; onToken(token); }
      }
      if (!text.trim()) throw new AIProviderError('INVALID_RESPONSE');
      recordProviderMetric({ provider: 'gemini', model: responseModel, startedAt, outcome: 'success' });
      return { text, model: responseModel, inputTokens, outputTokens };
    } catch (error) {
      recordProviderMetric({ provider: 'gemini', model, startedAt, outcome: 'failure', errorType: error instanceof Error ? error.name : 'UnknownError' });
      if (error instanceof AIProviderError || error instanceof AIConfigurationError) throw error;
      const providerError = error as { status?: number; message?: string; name?: string };
      if (providerError.status === 429) throw new AIProviderError('RATE_LIMIT');
      if (/timeout/i.test(providerError.name || '') || /timeout/i.test(providerError.message || '')) throw new AIProviderError('TIMEOUT');
      if (providerError.status === 400 && /context|token|too long/i.test(providerError.message || '')) throw new AIProviderError('CONTEXT');
      throw new AIProviderError('UNAVAILABLE');
    }
  }
}
