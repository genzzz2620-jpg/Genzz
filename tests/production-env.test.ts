import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from '../lib/production-env.cjs';

const validEnvironment = () => ({
  DATABASE_URL: 'postgresql://app:secret@db.example.test:5432/genzz',
  NEXTAUTH_URL: 'https://app.example.test',
  NEXT_PUBLIC_APP_URL: 'https://app.example.test',
  NEXTAUTH_SECRET: 'a'.repeat(40),
  RESUME_STORAGE_DIR: 'C:\\private\\genzz-resumes',
  OPENAI_API_KEY: 'server-only-test-key',
});

test('production environment accepts complete private HTTPS configuration', () => {
  const result = validateProductionEnvironment(validEnvironment(), 'C:\\app');
  assert.deepEqual(result.errors, []);
});

test('production environment reports missing values without printing their contents', () => {
  const result = validateProductionEnvironment({}, 'C:\\app');
  assert.ok(result.errors.some((error) => error.includes('DATABASE_URL')));
  assert.ok(result.errors.some((error) => error.includes('NEXTAUTH_SECRET')));
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('production environment rejects insecure origins and public resume storage', () => {
  const env = { ...validEnvironment(), NEXTAUTH_URL: 'http://app.example.test', RESUME_STORAGE_DIR: 'C:\\app\\public\\uploads' };
  const result = validateProductionEnvironment(env, 'C:\\app');
  assert.ok(result.errors.some((error) => error.includes('HTTPS')));
  assert.ok(result.errors.some((error) => error.includes('outside the public directory')));
});

test('production environment rejects partial Stripe configuration', () => {
  const env = { ...validEnvironment(), STRIPE_SECRET_KEY: 'server-side-test-secret' };
  const result = validateProductionEnvironment(env, 'C:\\app');
  assert.ok(result.errors.some((error) => error.includes('STRIPE_SECRET_KEY')));
});
