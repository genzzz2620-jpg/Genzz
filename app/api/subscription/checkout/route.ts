import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { BILLING_CONFIG } from '@/lib/billing/plans';
import { getPaymentProvider } from '@/lib/billing/stripe-provider';
import { PaymentProviderError } from '@/lib/billing/payment-provider';
import { trustedAppOrigin } from '@/lib/security/app-origin';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Sign in before upgrading your plan.' }, { status: 401 });
  const limit = consumeRateLimit(`billing-checkout:${auth.user.id}`, 5, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many checkout requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  if (!BILLING_CONFIG.paymentConfigured) return NextResponse.json({ error: 'Premium checkout is not configured on this server.' }, { status: 503 });
  const { plan } = await getCurrentSubscription(auth.user.id);
  if (plan === 'PREMIUM') return NextResponse.json({ error: 'Your account already has Premium access.' }, { status: 409 });
  const existing = await prisma.subscription.findFirst({ where: { userId: auth.user.id, provider: 'stripe', providerCustomerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { providerCustomerId: true } });
  try {
    const provider = getPaymentProvider();
    const origin = trustedAppOrigin(request.url);
    const checkout = await provider.createCheckout({ userId: auth.user.id, email: auth.user.email || '', customerId: existing?.providerCustomerId || undefined, successUrl: `${origin}/subscription?checkout=success`, cancelUrl: `${origin}/pricing?checkout=cancelled` });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : 'Unable to start Premium checkout.' }, { status: 502 });
  }
}
