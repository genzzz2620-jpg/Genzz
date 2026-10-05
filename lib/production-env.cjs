function normalizeAbsolutePath(value, windows) {
  if (windows) {
    const drive = value.match(/^([a-z]:)[\\/]/i)?.[1].toLowerCase();
    if (!drive) return null;
    const parts = value.slice(2).split(/[\\/]+/).filter(Boolean);
    const stack = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part.toLowerCase());
    }
    return `${drive}\\${stack.join('\\')}`;
  }
  if (!value.startsWith('/')) return null;
  const stack = [];
  for (const part of value.split('/').filter(Boolean)) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return `/${stack.join('/')}`;
}

function validateProductionEnvironment(env = process.env, cwd = process.cwd()) {
  const errors = [];
  const warnings = [];
  const requiredNames = ['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'NEXT_PUBLIC_APP_URL', 'RESUME_STORAGE_DIR'];
  for (const name of requiredNames) if (!env[name]?.trim()) errors.push(`${name} is required.`);

  if (env.NEXTAUTH_SECRET?.trim() && Buffer.byteLength(env.NEXTAUTH_SECRET.trim(), 'utf8') < 32) {
    errors.push('NEXTAUTH_SECRET must contain at least 32 UTF-8 bytes.');
  }

  let appOrigin = '';
  for (const name of ['NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL']) {
    const value = env[name]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') errors.push(`${name} must use HTTPS in production.`);
      if (url.username || url.password) errors.push(`${name} must not contain credentials.`);
      if (url.pathname !== '/' || url.search || url.hash) errors.push(`${name} must be an origin without a path, query, or fragment.`);
      if (name === 'NEXT_PUBLIC_APP_URL') appOrigin = url.origin;
      else if (appOrigin && url.origin !== appOrigin) errors.push('NEXTAUTH_URL and NEXT_PUBLIC_APP_URL must use the same origin.');
    } catch {
      errors.push(`${name} must be a valid absolute URL.`);
    }
  }
  if (env.NEXTAUTH_URL && env.NEXT_PUBLIC_APP_URL) {
    try {
      if (new URL(env.NEXTAUTH_URL).origin !== new URL(env.NEXT_PUBLIC_APP_URL).origin) errors.push('NEXTAUTH_URL and NEXT_PUBLIC_APP_URL must use the same origin.');
    } catch { /* URL-specific errors are already recorded above. */ }
  }

  if (env.DATABASE_URL?.trim()) {
    try {
      if (!['postgres:', 'postgresql:'].includes(new URL(env.DATABASE_URL).protocol)) errors.push('DATABASE_URL must use PostgreSQL.');
    } catch {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection URL.');
    }
  }

  if (env.RESUME_STORAGE_DIR?.trim()) {
    const storage = env.RESUME_STORAGE_DIR.trim();
    const windows = process.platform === 'win32';
    const absoluteStorage = normalizeAbsolutePath(storage, windows);
    if (!absoluteStorage) errors.push('RESUME_STORAGE_DIR must be an absolute path to durable private storage in production.');
    const publicDirectory = normalizeAbsolutePath(`${cwd}${windows ? '\\' : '/'}public`, windows);
    if (absoluteStorage && publicDirectory && (absoluteStorage === publicDirectory || absoluteStorage.startsWith(`${publicDirectory}${windows ? '\\' : '/'}`))) {
      errors.push('RESUME_STORAGE_DIR must be outside the public directory.');
    }
  }

  if (!env.OPENAI_API_KEY?.trim() && !env.GEMINI_API_KEY?.trim()) {
    errors.push('Configure at least one server-side AI provider key.');
  }

  const stripeNames = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PREMIUM_PRICE_ID'];
  const stripeCount = stripeNames.filter((name) => Boolean(env[name]?.trim())).length;
  if (stripeCount > 0 && stripeCount < stripeNames.length) {
    errors.push('Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PREMIUM_PRICE_ID together, or leave all three unset.');
  }
  if (stripeCount === 0) warnings.push('Stripe checkout is not configured.');

  return { errors, warnings };
}

module.exports = { validateProductionEnvironment };
