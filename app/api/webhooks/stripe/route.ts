import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { getPaymentProvider } from '@/lib/billing/stripe-provider';
import { PaymentProviderError } from '@/lib/billing/payment-provider';
import { createNotification } from '@/lib/notifications';
import { addCreditsInTransaction } from '@/lib/billing/credits';

export const runtime = 'nodejs';

function objectId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return null;
}
function epochDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
}
function stripeStatus(value: unknown) {
  if (value === 'active') return 'ACTIVE';
  if (value === 'trialing') return 'TRIALING';
  if (value === 'past_due' || value === 'unpaid' || value === 'incomplete') return 'PAST_DUE';
  if (value === 'canceled') return 'CANCELED';
  if (value === 'incomplete_expired') return 'EXPIRED';
  return 'PAST_DUE';
}

async function syncStripeSubscription(stripeSubscription: Record<string, unknown>, knownUserId?: string | null, statusOverride?: string) {
  const providerSubscriptionId = typeof stripeSubscription.id === 'string' ? stripeSubscription.id : null;
  if (!providerSubscriptionId) throw new Error('Billing event has no subscription identifier.');
  const existing = await prisma.subscription.findUnique({ where: { providerSubscriptionId }, select: { userId: true } });
  const metadata = stripeSubscription.metadata as Record<string, unknown> | undefined;
  if (existing && knownUserId && existing.userId !== knownUserId) throw new Error('Billing subscription ownership mismatch.');
  const userId = existing?.userId || knownUserId || (typeof metadata?.userId === 'string' ? metadata.userId : null);
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) return;

  const firstItem = (stripeSubscription.items as { data?: Array<Record<string, unknown>> } | undefined)?.data?.[0];
  const currentPeriodStart = epochDate(stripeSubscription.current_period_start) || epochDate(firstItem?.current_period_start);
  const currentPeriodEnd = epochDate(stripeSubscription.current_period_end) || epochDate(firstItem?.current_period_end);
  const customerId = objectId(stripeSubscription.customer);
  const status = statusOverride || stripeStatus(stripeSubscription.status);
  const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end === true;
  const data = {
    userId, plan: 'PREMIUM' as const, status, provider: 'stripe', providerCustomerId: customerId,
    providerSubscriptionId, startDate: epochDate(stripeSubscription.start_date) || currentPeriodStart || new Date(),
    endDate: currentPeriodEnd, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd,
  };
  await prisma.subscription.upsert({ where: { providerSubscriptionId }, create: data, update: data });
  await getCurrentSubscription(userId);
}

async function readWebhookBody(request: Request) {
  const maxBytes = 1024 * 1024;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new RangeError('Webhook body is too large.');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RangeError('Webhook body is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature') || '';
  let event;
  let body: string;
  try { body = await readWebhookBody(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid billing webhook.' }, { status: error instanceof RangeError ? 413 : 400 }); }
  try { event = getPaymentProvider().verifyWebhook(body, signature); }
  catch (error) { return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : 'Invalid billing webhook.' }, { status: 400 }); }

  try {
    if (await prisma.billingWebhookEvent.findUnique({ where: { id: event.id } })) return NextResponse.json({ received: true, duplicate: true });
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && event.object.mode === 'payment') {
      if (event.object.payment_status !== 'paid') return NextResponse.json({ received: true, pending: true });
      const checkoutId = typeof event.object.id === 'string' ? event.object.id : '';
      await prisma.$transaction(async tx => {
        const priorEvent = await tx.billingWebhookEvent.findUnique({ where: { id: event.id } });
        if (priorEvent) return;
        const checkout = await tx.creditCheckout.findUnique({ where: { providerCheckoutId: checkoutId } });
        if (!checkout) throw new Error('Credit checkout record was not found.');
        const metadata = event.object.metadata as Record<string, unknown> | undefined;
        if (typeof metadata?.userId === 'string' && metadata.userId !== checkout.userId) throw new Error('Credit checkout owner mismatch.');
        if (typeof metadata?.packId === 'string' && metadata.packId !== checkout.packId) throw new Error('Credit pack mismatch.');
        if (checkout.status !== 'COMPLETED') {
          await addCreditsInTransaction(tx, checkout.userId, checkout.amountUnits, `credit-purchase:${checkout.id}`, { packId: checkout.packId });
          await tx.creditCheckout.update({ where: { id: checkout.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        }
        await tx.billingWebhookEvent.create({ data: { id: event.id, type: event.type } });
      }, { isolationLevel: 'Serializable' });
      return NextResponse.json({ received: true });
    }
    if (event.type === 'checkout.session.async_payment_failed' && event.object.mode === 'payment' && typeof event.object.id === 'string') {
      await prisma.creditCheckout.updateMany({ where: { providerCheckoutId: event.object.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    }
    if (event.type.startsWith('customer.subscription.') && typeof event.object.id === 'string') {
      await syncStripeSubscription(event.object);
    } else if (event.type === 'checkout.session.completed' && event.object.mode === 'subscription') {
      const subscriptionId = objectId(event.object.subscription);
      if (subscriptionId) {
        const subscription = await getPaymentProvider().getSubscription(subscriptionId);
        const metadata = event.object.metadata as Record<string, unknown> | undefined;
        const userId = typeof metadata?.userId === 'string' ? metadata.userId : typeof event.object.client_reference_id === 'string' ? event.object.client_reference_id : null;
        await syncStripeSubscription(subscription, userId);
      }
    } else if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const parent = event.object.parent as { subscription_details?: { subscription?: unknown } } | undefined;
      const subscriptionId = objectId(event.object.subscription) || objectId(parent?.subscription_details?.subscription);
      if (subscriptionId) await syncStripeSubscription(await getPaymentProvider().getSubscription(subscriptionId), null, event.type === 'invoice.payment_failed' ? 'PAST_DUE' : undefined);
    }
    let affectedSubscriptionId: string | null = null;
    if (typeof event.object.id === 'string' && event.type.startsWith('customer.subscription.')) affectedSubscriptionId = event.object.id;
    else if (event.type === 'checkout.session.completed') affectedSubscriptionId = objectId(event.object.subscription);
    else if (event.type.startsWith('invoice.')) {
      const parent = event.object.parent as { subscription_details?: { subscription?: unknown } } | undefined;
      affectedSubscriptionId = objectId(event.object.subscription) || objectId(parent?.subscription_details?.subscription);
    }
    if (affectedSubscriptionId) {
      const subscription = await prisma.subscription.findUnique({ where: { providerSubscriptionId: affectedSubscriptionId }, select: { userId: true, status: true, plan: true } });
      if (subscription) {
        const paymentFailed = event.type === 'invoice.payment_failed';
        const expired = event.type === 'customer.subscription.deleted' || subscription.status === 'EXPIRED';
        const activated = event.type === 'checkout.session.completed' && subscription.status === 'ACTIVE';
        const title = paymentFailed ? 'Payment requires attention' : expired ? 'Subscription expired' : activated ? 'Premium activated' : 'Subscription updated';
        const message = paymentFailed ? 'Your payment needs attention. Visit subscription settings to review your options.' : expired ? 'Your subscription has ended. You can review available plans anytime.' : activated ? 'Premium access is active on your account.' : 'A confirmed billing update was applied to your account.';
        await createNotification({ userId: subscription.userId, type: paymentFailed ? 'PAYMENT_STATUS' : 'SUBSCRIPTION_UPDATED', category: 'SUBSCRIPTION', title, message, actionUrl: '/subscription', eventKey: `billing:${event.id}` }).catch(() => undefined);
      }
    }
    await prisma.billingWebhookEvent.create({ data: { id: event.id, type: event.type } }).catch(async error => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return;
      throw error;
    });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Unable to apply this billing event.' }, { status: 500 });
  }
}
