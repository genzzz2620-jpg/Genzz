export type CheckoutInput = { userId: string; email: string; successUrl: string; cancelUrl: string; customerId?: string };
export type WebhookEvent = { id: string; type: string; object: Record<string, unknown> };

export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  createCreditCheckout(input: CheckoutInput & { priceId: string; packId: string; units: number; idempotencyKey: string }): Promise<{ url: string; checkoutId: string }>;
  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
  verifyWebhook(body: string, signature: string): WebhookEvent;
  getSubscription(id: string): Promise<Record<string, unknown>>;
}

export class PaymentProviderError extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentProviderError'; }
}
