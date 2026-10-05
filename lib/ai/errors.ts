export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigurationError';
  }
}

export type AIProviderErrorKind = 'RATE_LIMIT' | 'TIMEOUT' | 'CONTEXT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class AIProviderError extends Error {
  constructor(readonly kind: AIProviderErrorKind) {
    super('The selected AI provider could not complete the request.');
    this.name = 'AIProviderError';
  }
}
