import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCategoryCounts, aggregateFeedback, buildSessionFilter, calculateCreditMetrics, calculateDurationSeconds, calculateStreak, normalizeCategory, parseAnalyticsFilters } from '../lib/analytics/metrics.ts';

test('parses date filters, validates custom range and session id', () => {
  const now = new Date('2026-09-27T12:00:00Z');
  assert.equal(parseAnalyticsFilters(new URLSearchParams('period=7'), now).from?.toISOString(), '2026-09-20T12:00:00.000Z');
  const custom = parseAnalyticsFilters(new URLSearchParams('period=custom&from=2026-09-01&to=2026-09-27'), now);
  assert.equal(custom.to.toISOString(), '2026-09-28T00:00:00.000Z');
  assert.throws(() => parseAnalyticsFilters(new URLSearchParams('period=custom&from=2026-09-28&to=2026-09-29'), now));
  assert.throws(() => parseAnalyticsFilters(new URLSearchParams('period=all&sessionId=someone-elses-id'), now));
});

test('session filters always scope to owner and apply requested dimensions', () => {
  const filters = parseAnalyticsFilters(new URLSearchParams('period=all&role=Engineer&company=Example&experience=Senior'), new Date('2026-09-27T00:00:00Z'));
  const where = buildSessionFilter('user-a', filters) as { userId: string; AND: Array<Record<string, unknown>> };
  assert.equal(where.userId, 'user-a');
  assert.equal(where.AND.length, 5);
  assert.deepEqual(where.AND[2], { jobTitle: 'Engineer' });
});

test('normalizes and groups practice question categories', () => {
  assert.equal(normalizeCategory('system-design'), 'System Design');
  assert.deepEqual(aggregateCategoryCounts([{ questionType: 'TECHNICAL', _count: { _all: 2 } }, { questionType: 'DATABASE', _count: { _all: 3 } }]), [{ category: 'Technical', count: 5 }]);
});

test('aggregates feedback by distinct sessions and gates trend displays', () => {
  const rows = [
    { sessionId: 'one', createdAt: '2026-01-05T12:00:00Z', jobTitle: 'Engineer', strengths: ['Clear communication'], improvementAreas: ['More detail'] },
    { sessionId: 'two', createdAt: '2026-01-06T12:00:00Z', jobTitle: 'Engineer', strengths: ['Clear communication'], improvementAreas: ['More detail'] },
    { sessionId: 'three', createdAt: '2026-02-05T12:00:00Z', jobTitle: 'Engineer', strengths: ['Clear communication'], improvementAreas: ['More detail'] },
    { sessionId: 'four', createdAt: '2026-02-06T12:00:00Z', jobTitle: 'Engineer', strengths: ['Clear communication'], improvementAreas: ['More detail'] },
  ];
  const result = aggregateFeedback(rows);
  assert.equal(result.feedbackSessions, 4);
  assert.equal(result.strengths[0].sessionCount, 4);
  assert.equal(result.trendsSufficient, true);
  assert.equal(aggregateFeedback(rows.slice(0, 2)).trendsSufficient, false);
});

test('calculates streaks, duration and credit use with safe integer units', () => {
  assert.deepEqual(calculateStreak(['2026-09-25', '2026-09-26', '2026-09-27'], new Date('2026-09-27T08:00:00Z')), { current: 3, longest: 3 });
  assert.equal(calculateDurationSeconds([{ durationSeconds: 120, status: 'COMPLETED', startedAt: null }]), 120);
  assert.deepEqual(calculateCreditMetrics([{ type: 'SESSION_CONSUMPTION', amountUnits: -100, sessionId: 's1' }, { type: 'SESSION_CONSUMPTION', amountUnits: -50, sessionId: 's1' }, { type: 'SESSION_RESERVATION', amountUnits: -100, sessionId: 's2' }]), { creditsUsedUnits: 150, sessionsStartedWithCredits: 1 });
});
