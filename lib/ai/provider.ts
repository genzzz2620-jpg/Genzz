import type { AIModel, AIProvider } from './types';
import { AIConfigurationError } from './errors';
import { GeminiProvider } from './gemini-provider';
import { OpenAIProvider } from './openai-provider';

const providers: Record<AIModel, AIProvider> = {
  ChatGPT: new OpenAIProvider(),
  Gemini: new GeminiProvider(),
};

export function getAIProvider(model: string): AIProvider {
  if (model !== 'ChatGPT' && model !== 'Gemini') {
    throw new AIConfigurationError('The selected AI model is not supported.');
  }
  return providers[model];
}
