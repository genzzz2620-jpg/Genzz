import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

if (existsSync('.env.e2e')) process.loadEnvFile('.env.e2e');

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const target = new URL(baseURL);
const targetHost = target.host.toLowerCase();
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname.toLowerCase());
const isLocalRun = !process.env.E2E_BASE_URL && isLocal;
if (isLocalRun && !process.env.E2E_DATABASE_URL) {
  throw new Error('Set E2E_DATABASE_URL to a dedicated, migrated test database before running local browser tests.');
}
if (isLocalRun) {
  process.env.E2E_BASE_URL = baseURL;
  process.env.E2E_ENVIRONMENT = 'staging';
  process.env.E2E_EXPECT_BILLING_UNCONFIGURED = 'true';
}
if (process.env.E2E_ENVIRONMENT !== 'staging' && !isLocalRun) throw new Error('Browser tests require E2E_ENVIRONMENT=staging. Production testing is refused.');
if (!isLocal && (target.protocol !== 'https:' || process.env.E2E_TARGET_CONFIRM?.toLowerCase() !== targetHost)) {
  throw new Error('Remote staging tests require HTTPS and E2E_TARGET_CONFIRM set to the exact staging host.');
}
if (/(^|[.-])(prod|production|live|www)([.-]|$)/i.test(target.hostname)) {
  throw new Error('Production-looking hostnames are refused by the E2E configuration.');
}

export default defineConfig({
  testDir: './tests/e2e',
  projects: [{ name: 'chromium' }],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    ...devices['Desktop Chrome'],
  },
  ...(isLocalRun ? {
    webServer: {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
      url: baseURL,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.E2E_DATABASE_URL!,
        E2E_BASE_URL: baseURL,
        E2E_ENVIRONMENT: 'staging',
        E2E_EXPECT_BILLING_UNCONFIGURED: 'true',
        NEXTAUTH_URL: baseURL,
        NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
        NEXT_PUBLIC_APP_URL: baseURL,
        RESUME_STORAGE_DIR: `${process.env.TEMP ?? process.env.TMP ?? '.'}/genz-playwright-resumes`,
        OPENAI_API_KEY: '',
        GEMINI_API_KEY: '',
        STRIPE_SECRET_KEY: '',
        STRIPE_WEBHOOK_SECRET: '',
        STRIPE_PREMIUM_PRICE_ID: '',
        STRIPE_CREDIT_PACK_STARTER_PRICE_ID: '',
        STRIPE_CREDIT_PACK_PLUS_PRICE_ID: '',
        STRIPE_CREDIT_PACK_PRO_PRICE_ID: '',
      },
    },
  } : {}),
});
