import { performance } from 'node:perf_hooks';

const target = new URL(process.argv[2] || 'http://localhost:3000');
const usersArg = process.argv.find((arg) => arg.startsWith('--users='))?.slice(8) || '10,25,50,100';
const userCounts = usersArg.split(',').map(Number);
if (userCounts.some((count) => !Number.isInteger(count) || count < 1 || count > 100)) {
  throw new Error('Use --users with comma-separated counts from 1 to 100.');
}
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
if (!localHosts.has(target.hostname)) {
  if (target.protocol !== 'https:' || process.env.ALLOW_STAGING_LOAD_TEST !== '1' || process.env.LOAD_TEST_TARGET_CONFIRM !== target.host) {
    throw new Error('Remote load checks require HTTPS, ALLOW_STAGING_LOAD_TEST=1, and LOAD_TEST_TARGET_CONFIRM equal to the target host. Use a staging host only.');
  }
  if (/prod(uction)?/i.test(target.hostname)) throw new Error('Production hosts are refused.');
}
target.pathname = '/api/health';
target.search = '';

for (const concurrency of userCounts) {
  const samples = [];
  const outcomes = await Promise.all(Array.from({ length: concurrency }, async () => {
    const start = performance.now();
    try {
      const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      samples.push(performance.now() - start);
      return response.ok;
    } catch {
      samples.push(performance.now() - start);
      return false;
    }
  }));
  samples.sort((a, b) => a - b);
  const percentile = (p) => samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)] || 0;
  console.log(JSON.stringify({ endpoint: target.href, concurrency, ok: outcomes.filter(Boolean).length, errors: outcomes.filter((ok) => !ok).length, p50Ms: Math.round(percentile(.5)), p95Ms: Math.round(percentile(.95)), maxMs: Math.round(samples.at(-1) || 0) }));
}
