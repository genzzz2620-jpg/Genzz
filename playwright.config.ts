import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('Set E2E_BASE_URL to the isolated staging application before running browser tests.');
const target = new URL(baseURL);
const targetHost = target.host.toLowerCase();
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname.toLowerCase());
if (process.env.E2E_ENVIRONMENT !== 'staging') throw new Error('Browser tests require E2E_ENVIRONMENT=staging. Production testing is refused.');
if (!isLocal && (target.protocol !== 'https:' || process.env.E2E_TARGET_CONFIRM?.toLowerCase() !== targetHost)) {
  throw new Error('Remote staging tests require HTTPS and E2E_TARGET_CONFIRM set to the exact staging host.');
}
if (/(^|[.-])(prod|production|live|www)([.-]|$)/i.test(target.hostname)) {
  throw new Error('Production-looking hostnames are refused by the E2E configuration.');
}

export default defineConfig({
  testDir: './tests/e2e',
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
});
