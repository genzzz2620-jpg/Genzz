import 'server-only';

import OpenAI from 'openai';
import type { AIProvider, AIProviderRequest, AIProviderResponse } from './types';
import { AIConfigurationError, AIProviderError } from './errors';
import { recordProviderMetric } from '@/lib/observability';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI | null = null;
  private clientApiKey = '';

  private getClient(apiKey: string) {
    if (!this.client || this.clientApiKey !== apiKey) {
      this.clientApiKey = apiKey;
      this.client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 });
    }
    return this.client;
  }

  async generateText(request: AIProviderRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AIConfigurationError('ChatGPT is not configured on this server.');
    }

    const client = this.getClient(apiKey);
    let response;
    const startedAt = Date.now();
    try {
      response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content: request.prompt },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      });
    } catch (error) {
      recordProviderMetric({ provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', startedAt, outcome: 'failure', errorType: error instanceof Error ? error.name : 'UnknownError' });
      if (error instanceof OpenAI.RateLimitError) throw new AIProviderError('RATE_LIMIT');
      if (error instanceof OpenAI.APIConnectionTimeoutError) throw new AIProviderError('TIMEOUT');
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) throw new AIProviderError('RATE_LIMIT');
        if (error.status === 400 && /context|token|too long/i.test(error.message)) throw new AIProviderError('CONTEXT');
      }
      throw new AIProviderError('UNAVAILABLE');
    }

    recordProviderMetric({ provider: 'openai', model: response.model || process.env.OPENAI_MODEL || 'gpt-4o-mini', startedAt, outcome: 'success' });

    const answer = response.choices[0]?.message.content;
    if (!answer?.trim()) throw new AIProviderError('INVALID_RESPONSE');
    const result: AIProviderResponse = {
      text: answer.trim(),
      model: response.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
    };
    return result;
  }

  async streamText(request: AIProviderRequest, onToken: (token: string) => void, signal?: AbortSignal) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new AIConfigurationError('ChatGPT is not configured on this server.');
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const client = this.getClient(apiKey);
    const startedAt = Date.now();
    try {
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content: request.prompt },
        ],
        temperature: 0.6,
        max_tokens: 1200,
        stream: true,
        stream_options: { include_usage: true },
      }, { signal });
      let text = '';
      let responseModel = model;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      for await (const part of stream) {
        if (part.model) responseModel = part.model;
        if (part.usage) { inputTokens = part.usage.prompt_tokens; outputTokens = part.usage.completion_tokens; }
        const token = part.choices[0]?.delta?.content;
        if (typeof token === 'string' && token) { text += token; onToken(token); }
      }
      if (!text.trim()) throw new AIProviderError('INVALID_RESPONSE');
      recordProviderMetric({ provider: 'openai', model: responseModel, startedAt, outcome: 'success' });
      return { text, model: responseModel, inputTokens, outputTokens };
    } catch (error) {
      recordProviderMetric({ provider: 'openai', model, startedAt, outcome: 'failure', errorType: error instanceof Error ? error.name : 'UnknownError' });
      if (error instanceof AIProviderError || error instanceof AIConfigurationError) throw error;
      if (error instanceof OpenAI.RateLimitError) throw new AIProviderError('RATE_LIMIT');
      if (error instanceof OpenAI.APIConnectionTimeoutError) throw new AIProviderError('TIMEOUT');
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) throw new AIProviderError('RATE_LIMIT');
        if (error.status === 400 && /context|token|too long/i.test(error.message)) throw new AIProviderError('CONTEXT');
      }
      throw new AIProviderError('UNAVAILABLE');
    }
  }
}
