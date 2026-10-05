import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const path = request.nextUrl.pathname;
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const nextAuthRoute = path.startsWith('/api/auth/');
  const stripeWebhook = path === '/api/webhooks/stripe';
  const desktopBearerRoute = path.startsWith('/api/desktop/') && path !== '/api/desktop/code';
  if (path.startsWith('/api/') && mutating && !nextAuthRoute && !stripeWebhook && !desktopBearerRoute) {
    const configuredOrigin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    const expectedOrigin = configuredOrigin ? new URL(configuredOrigin).origin : process.env.NODE_ENV === 'production' ? '' : request.nextUrl.origin;
    if (!expectedOrigin || request.headers.get('origin') !== expectedOrigin) {
      return NextResponse.json({ error: 'Cross-origin request denied.' }, { status: 403 });
    }
  }
  if (path.startsWith('/api/')) return nextWithRequestId(request, requestId);

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const adminRoute = path.startsWith('/admin');

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token.accountStatus === 'SUSPENDED') {
    return new NextResponse('403 Forbidden', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  if (adminRoute && token.role !== 'ADMIN') {
    return new NextResponse('403 Forbidden', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  return nextWithRequestId(request, requestId);
}

function nextWithRequestId(request: NextRequest, requestId: string) {
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/settings',
    '/subscription',
    '/question-bank/:path*',
    '/resume-maker/:path*',
    '/resumes/:path*',
    '/interviews/:path*',
    '/api/:path*',
  ],
};
