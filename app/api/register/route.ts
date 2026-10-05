import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, requestAddress } from '@/lib/security/rate-limit';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.'),
  confirmPassword: z.string().min(10, 'Password confirmation is required.').max(72),
});

export async function POST(request: Request) {
  const limit = consumeRateLimit(`register:${requestAddress(request.headers)}`, 5, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many account creation attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input.' }, { status: 400 });
  }

  const { name, email, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();
  try {

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        subscriptionType: 'FREE',
        onboardingStatus: 'NOT_STARTED',
        onboardingStep: 0,
        subscriptions: {
          create: {
            plan: 'FREE',
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionType: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    // The preflight lookup improves the common path, but concurrent signups can
    // still race on User.email's unique constraint. Keep that case consistent
    // with an ordinary duplicate email instead of returning a misleading 500.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Something went wrong while creating the account.' }, { status: 500 });
  }
}
