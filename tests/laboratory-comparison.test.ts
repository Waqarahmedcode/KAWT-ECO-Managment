import test from 'node:test';
import assert from 'node:assert/strict';
import { labReportSchema, csvValue, type LabReport } from '../lib/laboratory';
import { labSummaryQuery, summarizeLabReports, type LabSummaryQuery } from '../lib/laboratory-reporting';
import { comparisonQuery, compareLabPeriods, volumeChange } from '../lib/laboratory-comparison';

const query = (kind: string, start: string, end: string) => labSummaryQuery.parse({ kind, start, end });
function report(q: LabSummaryQuery, value: number): LabReport {
 return { ...labReportSchema.parse({ laboratory_name: q.laboratory_name, period_kind: q.kind, period_start: q.start, period_end: q.end, source_label: 'Synthetic comparison fixture', payload: { tests: [{ label: 'Test A', morning: value, evening: 0, night: 0 }, { label: 'Test B', morning: 0, evening: 0, night: 0 }], patients: { morning: 2, evening: 0, night: 0 }, outsource: { patients: 0, tests: 0 }, urgent: { morning: { patients: 0, tests: 0 }, evening: { patients: 0, tests: 0 }, night: { patients: 0, tests: 0 } } } }), id: q.start, revision: 1, updated_at: '2026-01-01T00:00:00Z' };
}
test('previous calendar periods preserve exact month, half-year and year boundaries', () => {
 assert.deepEqual(comparisonQuery(query('month', '2026-01-01', '2026-01-31'), 'previous_period').query, query('month', '2025-12-01', '2025-12-31'));
 assert.deepEqual(comparisonQuery(query('half_year', '2026-01-01', '2026-06-30'), 'previous_period').query, query('half_year', '2025-07-01', '2025-12-31'));
 assert.deepEqual(comparisonQuery(query('year', '2026-01-01', '2026-12-31'), 'previous_period').query, query('year', '2025-01-01', '2025-12-31'));
 assert.deepEqual(comparisonQuery(query('week', '2026-01-01', '2026-01-07'), 'previous_period').query, query('week', '2025-12-25', '2025-12-31'));
});
test('leap-year monthly comparison uses full month while impossible daily dates are not guessed', () => {
 assert.deepEqual(comparisonQuery(query('month', '2024-02-01', '2024-02-29'), 'previous_year').query, query('month', '2023-02-01', '2023-02-28'));
 assert.equal(comparisonQuery(query('day', '2024-02-29', '2024-02-29'), 'previous_year').query, null);
 assert.equal(comparisonQuery(query('day', '1900-01-01', '1900-01-01'), 'previous_period').query, null);
});
test('custom previous windows preserve inclusive duration and reject overlapping dates', () => {
 const current = query('custom', '2026-07-10', '2026-07-12');
 assert.deepEqual(comparisonQuery(current, 'previous_period').query, query('custom', '2026-07-07', '2026-07-09'));
 assert.equal(comparisonQuery(current, 'custom', { start: '2026-07-11', end: '2026-07-15' }).query, null);
});
test('actual reported increases, decreases and zero baselines have distinct meanings', () => {
 assert.equal(volumeChange(15, 10, true, true).percent, 50);
 assert.equal(volumeChange(0, 10, true, true).percent, -100);
 assert.deepEqual(volumeChange(7, 0, true, true), { current: 7, previous: 0, change: 7, percent: null, status: 'new_activity', note: 'Pichla count explicit zero tha; percentage available nahin' });
 assert.equal(volumeChange(0, 0, true, true).status, 'no_activity');
 assert.equal(volumeChange(0, 0, true, true).percent, 0);
 assert.equal(volumeChange(5, null, true, false).percent, null);
 assert.equal(volumeChange(5, 2, true, false).status, 'partial_data');
});
test('complete monthly reports compare without counting supplementary groups again', () => {
 const now = query('month', '2026-07-01', '2026-07-31'), before = query('month', '2026-06-01', '2026-06-30');
 const a = report(now, 15), b = report(before, 10);a.payload.outsource.tests = 100;
 const value = compareLabPeriods(summarizeLabReports([a], now), summarizeLabReports([b], before));
 assert.equal(value.totals[0].current, 15);assert.equal(value.totals[0].percent, 50);assert.equal(value.tests[0].percent, 50);
 assert.equal(value.tests[1].status, 'no_activity');assert.equal(value.current.days, 31);assert.equal(value.previous.days, 30);
});
test('missing prior month never creates a zero or a growth result', () => {
 const now = query('month', '2026-07-01', '2026-07-31'), before = query('month', '2026-06-01', '2026-06-30');
 const value = compareLabPeriods(summarizeLabReports([report(now, 15)], now), summarizeLabReports([], before));
 assert.equal(value.previous.found, false);assert.equal(value.totals[0].previous, null);assert.equal(value.totals[0].percent, null);assert.equal(value.tests[0].change, null);
});
test('changed test menus allow matched test comparisons but suppress misleading overall growth', () => {
 const now = query('month', '2026-07-01', '2026-07-31'), before = query('month', '2026-06-01', '2026-06-30');
 const a = report(now, 15), b = report(before, 10);a.payload.tests.push({ label: 'New test', morning: 2, evening: 0, night: 0 });
 const value = compareLabPeriods(summarizeLabReports([a], now), summarizeLabReports([b], before));
 assert.equal(value.totals[0].status, 'different_tests');assert.equal(value.tests.find(t => t.label === 'Test A')?.percent, 50);assert.equal(value.tests.find(t => t.label === 'New test')?.previous, null);
});
test('partial shifts and missing patient fields retain independent coverage', () => {
 const now = query('month', '2026-07-01', '2026-07-31'), before = query('month', '2026-06-01', '2026-06-30');
 const a = report(now, 15), b = report(before, 10);a.payload.tests[0].night = null;b.payload.patients.morning = null;
 const value = compareLabPeriods(summarizeLabReports([a], now), summarizeLabReports([b], before));
 assert.equal(value.totals[0].status, 'partial_data');assert.equal(value.shifts[0].tests.percent, 50);assert.equal(value.shifts[2].tests.percent, null);assert.equal(value.totals[1].status, 'partial_data');
});
test('one missing source day blocks growth without discarding observed counts', () => {
 const now = query('custom', '2026-07-01', '2026-07-02'), before = query('custom', '2026-06-29', '2026-06-30');
 const daily = query('day', '2026-07-01', '2026-07-01'), dailyBefore = query('day', '2026-06-29', '2026-06-29');
 const value = compareLabPeriods(summarizeLabReports([report(daily, 6)], now), summarizeLabReports([report(dailyBefore, 3)], before));
 assert.equal(value.totals[0].current, 6);assert.equal(value.totals[0].previous, 3);assert.equal(value.totals[0].status, 'partial_data');assert.equal(value.totals[0].percent, null);
});
test('laboratory mismatch and overlapping source windows are rejected', () => {
 const a = query('month', '2026-07-01', '2026-07-31'), b = query('month', '2026-06-01', '2026-06-30');
 const before = summarizeLabReports([report(b, 10)], b), now = summarizeLabReports([report(a, 15)], a);
 assert.throws(() => compareLabPeriods(now, { ...before, query: { ...b, laboratory_name: 'Other synthetic lab' } }), /MISMATCH/);
 assert.throws(() => compareLabPeriods(now, now), /OVERLAP/);
});
test('different complete manual durations show counts without misleading percentage growth', () => {
 const current = query('custom', '2026-07-01', '2026-07-02'), previous = query('custom', '2026-06-29', '2026-06-29');
 const value = compareLabPeriods(summarizeLabReports([report(query('day', '2026-07-01', '2026-07-01'), 2), report(query('day', '2026-07-02', '2026-07-02'), 4)], current), summarizeLabReports([report(query('day', '2026-06-29', '2026-06-29'), 3)], previous));
 assert.equal(value.totals[0].current, 6);assert.equal(value.totals[0].previous, 3);assert.equal(value.totals[0].status, 'different_periods');assert.equal(value.totals[0].percent, null);
});
test('negative numeric CSV changes stay numeric while untrusted spreadsheet strings are escaped', () => {
 assert.equal(csvValue(-5), '"-5"');assert.equal(csvValue('-5'), '"\'-5"');assert.equal(csvValue('=SUM(1,2)'), '"\'=SUM(1,2)"');
});
