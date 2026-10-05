import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { getPaymentProvider } from '@/lib/billing/stripe-provider';
import { PaymentProviderError } from '@/lib/billing/payment-provider';
import { trustedAppOrigin } from '@/lib/security/app-origin';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

export async function POST() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Sign in to manage billing.' }, { status: 401 });
  const limit = consumeRateLimit(`billing-portal:${auth.user.id}`, 10, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many billing portal requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  const { subscription } = await getCurrentSubscription(auth.user.id);
  if (subscription.provider !== 'stripe' || !subscription.providerCustomerId) return NextResponse.json({ error: 'No online billing account is associated with this subscription.' }, { status: 409 });
  try {
    const portal = await getPaymentProvider().createPortal(subscription.providerCustomerId, `${trustedAppOrigin()}/subscription`);
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : 'Unable to open billing management.' }, { status: 502 });
  }
}
