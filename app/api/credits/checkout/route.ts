import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { CREDIT_PACKS, creditCheckoutIdempotencyKey } from '@/lib/billing/credits';
import { getPaymentProvider } from '@/lib/billing/stripe-provider';
import { PaymentProviderError } from '@/lib/billing/payment-provider';
import { trustedAppOrigin } from '@/lib/security/app-origin';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in before purchasing credits.' }, { status: 401 });
  const limit = consumeRateLimit(`credit-checkout:${auth.user.id}`, 5, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many checkout requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const packId = body && typeof body === 'object' && 'packId' in body && typeof body.packId === 'string' ? body.packId : '';
  const pack = CREDIT_PACKS.find(item => item.id === packId);
  if (!pack) return NextResponse.json({ error: 'Choose a valid credit pack.' }, { status: 400 });
  if (!pack.priceId || !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Credit purchases are not configured on this server.' }, { status: 503 });
  const idempotencyKey = creditCheckoutIdempotencyKey(auth.user.id);
  try {
    const origin = trustedAppOrigin(request.url);
    const checkout = await getPaymentProvider().createCreditCheckout({ userId: auth.user.id, email: auth.user.email || '', priceId: pack.priceId, packId: pack.id, units: pack.units, idempotencyKey, successUrl: `${origin}/dashboard?credits=purchased`, cancelUrl: `${origin}/dashboard?credits=cancelled` });
    await prisma.creditCheckout.create({ data: { userId: auth.user.id, providerCheckoutId: checkout.checkoutId, packId: pack.id, amountUnits: pack.units } });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : 'Unable to start credit checkout.' }, { status: 502 });
  }
}
