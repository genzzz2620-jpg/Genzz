/** Return a trusted public origin for provider redirects; never derive production redirects from Host. */
export function trustedAppOrigin(requestUrl?: string) {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.username || url.password || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('Application origin is not securely configured.');
    return url.origin;
  }
  if (process.env.NODE_ENV === 'production' || !requestUrl) throw new Error('Application origin is not configured.');
  return new URL(requestUrl).origin;
}
