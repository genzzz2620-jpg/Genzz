import { createHmac, timingSafeEqual } from 'node:crypto';
import { BILLING_CONFIG } from './plans';
import { PaymentProviderError, type CheckoutInput, type PaymentProvider, type WebhookEvent } from './payment-provider';

const apiBase = 'https://api.stripe.com/v1';

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly configured = Boolean(process.env.STRIPE_SECRET_KEY && BILLING_CONFIG.premiumPriceId && process.env.STRIPE_WEBHOOK_SECRET);
  private get secretKey() { return process.env.STRIPE_SECRET_KEY || ''; }

  private ensureCheckoutConfig() {
    if (!this.secretKey || !BILLING_CONFIG.premiumPriceId || !process.env.STRIPE_WEBHOOK_SECRET) throw new PaymentProviderError('Premium checkout is not configured on this server.');
  }

  private async request(path: string, init: RequestInit) {
    if (!this.secretKey) throw new PaymentProviderError('Billing is not configured on this server.');
    const response = await fetch(`${apiBase}${path}`, { ...init, headers: { Authorization: `Bearer ${this.secretKey}`, ...init.headers } });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    const providerError = result.error && typeof result.error === 'object' ? result.error as Record<string, unknown> : {};
    if (!response.ok) throw new PaymentProviderError(typeof providerError.message === 'string' ? providerError.message : 'The billing provider could not complete this request.');
    return result;
  }

  async createCheckout(input: CheckoutInput) {
    this.ensureCheckoutConfig();
    const form = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': BILLING_CONFIG.premiumPriceId,
      'line_items[0][quantity]': '1',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      'metadata[userId]': input.userId,
      'subscription_data[metadata][userId]': input.userId,
    });
    if (input.customerId) form.set('customer', input.customerId);
    else if (input.email) form.set('customer_email', input.email);
    const session = await this.request('/checkout/sessions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    if (typeof session.url !== 'string') throw new PaymentProviderError('The billing provider did not return a checkout URL.');
    return { url: session.url };
  }

  async createCreditCheckout(input: CheckoutInput & { priceId: string; packId: string; units: number; idempotencyKey: string }) {
    if (!this.secretKey || !input.priceId || !process.env.STRIPE_WEBHOOK_SECRET) throw new PaymentProviderError('Credit checkout is not configured on this server.');
    const form = new URLSearchParams({
      mode: 'payment', 'line_items[0][price]': input.priceId, 'line_items[0][quantity]': '1',
      success_url: input.successUrl, cancel_url: input.cancelUrl, client_reference_id: input.userId,
      'metadata[userId]': input.userId, 'metadata[packId]': input.packId,
      'payment_intent_data[metadata][userId]': input.userId,
    });
    if (input.customerId) form.set('customer', input.customerId);
    else if (input.email) form.set('customer_email', input.email);
    const session = await this.request('/checkout/sessions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': input.idempotencyKey }, body: form });
    if (typeof session.url !== 'string' || typeof session.id !== 'string') throw new PaymentProviderError('The billing provider did not return a credit checkout URL.');
    return { url: session.url, checkoutId: session.id };
  }

  async createPortal(customerId: string, returnUrl: string) {
    const form = new URLSearchParams({ customer: customerId, return_url: returnUrl });
    const portal = await this.request('/billing_portal/sessions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    if (typeof portal.url !== 'string') throw new PaymentProviderError('The billing provider did not return a management URL.');
    return { url: portal.url };
  }

  verifyWebhook(body: string, signature: string): WebhookEvent {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new PaymentProviderError('Webhook signing is not configured.');
    const pieces = signature.split(',').map(part => part.split('='));
    const timestamp = pieces.find(([key]) => key === 't')?.[1];
    const signatures = pieces.filter(([key]) => key === 'v1').map(([, value]) => value).filter((value): value is string => Boolean(value));
    const epoch = Number(timestamp);
    if (!timestamp || !Number.isFinite(epoch) || Math.abs(Date.now() / 1000 - epoch) > 300 || !signatures.length) throw new PaymentProviderError('Invalid billing webhook signature.');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest();
    const valid = signatures.some(value => {
      try { const supplied = Buffer.from(value, 'hex'); return supplied.length === expected.length && timingSafeEqual(supplied, expected); } catch { return false; }
    });
    if (!valid) throw new PaymentProviderError('Invalid billing webhook signature.');
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(body) as Record<string, unknown>; } catch { throw new PaymentProviderError('Invalid billing webhook body.'); }
    const eventData = parsed.data && typeof parsed.data === 'object' ? parsed.data as Record<string, unknown> : null;
    const object = eventData?.object;
    if (typeof parsed.id !== 'string' || typeof parsed.type !== 'string' || !object || typeof object !== 'object' || Array.isArray(object)) throw new PaymentProviderError('Invalid billing webhook event.');
    return { id: parsed.id, type: parsed.type, object: object as Record<string, unknown> };
  }

  async getSubscription(id: string) {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`, { method: 'GET' });
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (BILLING_CONFIG.provider !== 'stripe') throw new PaymentProviderError(`Payment provider "${BILLING_CONFIG.provider}" is not supported.`);
  return new StripePaymentProvider();
}
