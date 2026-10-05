export async function register() {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { validateProductionEnvironment } = await import('./lib/production-env.cjs');
  const { errors } = validateProductionEnvironment();
  if (errors.length) {
    throw new Error(`Production environment validation failed: ${errors.join(' ')}`);
  }
}
