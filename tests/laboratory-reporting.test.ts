import test from 'node:test';
import assert from 'node:assert/strict';
import { labSummaryQuery, summarizeLabReports } from '../lib/laboratory-reporting';
import { labReportSchema, mainLaboratoryName, type LabReport } from '../lib/laboratory';
import { parseLabCsv, parseLabSheets, sourcePeriod } from '../lib/laboratory-import';
import { karachiDate, medicalCentreInput, rupeesToMinor } from '../lib/medical-centre';
// Synthetic in-memory fixtures only. No patient or source-business records.
function source(kind: 'day' | 'month', start: string, end: string, value: number, id: string): LabReport {
 return { ...labReportSchema.parse({ period_kind: kind, period_start: start, period_end: end, source_label: 'Synthetic test source', payload: { tests: [{ label: 'Test A', morning: value, evening: 0, night: 0 }, { label: 'Test B', morning: 0, evening: 0, night: 0 }], patients: { morning: 1, evening: 0, night: 0 }, outsource: { patients: 1, tests: 1 }, urgent: { morning: { patients: 1, tests: 1 }, evening: { patients: 0, tests: 0 }, night: { patients: 0, tests: 0 } } } }), id, revision: 1, updated_at: '2026-08-01T00:00:00Z' };
}
const month = labSummaryQuery.parse({ kind: 'month', start: '2026-07-01', end: '2026-07-31' });
test('monthly snapshot takes precedence over its overlapping daily detail', () => {
 const result = summarizeLabReports([source('month', month.start, month.end, 10, 'month'), source('day', '2026-07-05', '2026-07-05', 2, 'day')], month);
 assert(result.found);assert.equal(result.stats.testTotal, 10);assert.equal(result.sources.length, 1);assert.equal(result.selected_daily_dates.length, 0);
 assert.deepEqual(result.verified_zero_tests, ['Test B']);
});
test('monthly file never supplies a fictional daily count', () => {
 const result = summarizeLabReports([source('month', month.start, month.end, 10, 'month')], labSummaryQuery.parse({ kind: 'day', start: '2026-07-05', end: '2026-07-05' }));
 assert.equal(result.found, false);
});
test('daily files roll up without filling absent days with zero', () => {
 const result = summarizeLabReports([source('day', '2026-07-01', '2026-07-01', 2, 'day1'), source('day', '2026-07-02', '2026-07-02', 3, 'day2')], month);
 assert(result.found);assert.equal(result.stats.testTotal, 5);assert.equal(result.missing_dates.length, 29);assert.equal(result.complete_source_coverage, false);assert.deepEqual(result.verified_zero_tests, []);
});
test('annual report uses available monthly source and marks the rest incomplete', () => {
 const result = summarizeLabReports([source('month', month.start, month.end, 10, 'month')], labSummaryQuery.parse({ kind: 'year', start: '2026-01-01', end: '2026-12-31' }));
 assert(result.found);assert.equal(result.stats.testTotal, 10);assert.equal(result.complete_source_coverage, false);assert.equal(result.missing_dates.length, 334);
});
test('a source from another laboratory does not enter a rollup', () => {
 const other = source('month', month.start, month.end, 100, 'other');other.laboratory_name = 'Other synthetic test lab';
 const result = summarizeLabReports([source('month', month.start, month.end, 10, 'own'), other], month);
 assert(result.found);assert.equal(result.stats.testTotal, 10);
});
test('manual range can read a native aggregate only at its full boundary', () => {
 const data = source('month', month.start, month.end, 10, 'month');
 assert(summarizeLabReports([data], labSummaryQuery.parse({ kind: 'custom', start: month.start, end: month.end })).found);
 assert.equal(summarizeLabReports([data], labSummaryQuery.parse({ kind: 'custom', start: '2026-07-10', end: '2026-07-20' })).found, false);
});
test('month-only header is a month, while ambiguous filename-like date is not inferred', () => {
 assert.deepEqual(sourcePeriod('Date: July 2026'), { period_kind: 'month', period_start: '2026-07-01', period_end: '2026-07-31' });
 assert.equal(sourcePeriod('2-8-2026.pdf'), null);
 assert.equal(sourcePeriod('Date: 2/8/2026'), null);
 assert.equal(sourcePeriod('Date: 31 July 2026')?.period_kind, 'day');
});
test('CSV dates group reports, never patient counts inferred from test count', () => {
 const reports = parseLabCsv('Date,Test,Morning,Evening,Night\n2026-07-01,Test A,2,0,0\n2026-07-02,Test A,3,0,0\n', 'synthetic.csv');
 assert.equal(reports.length, 2);assert.equal(reports[0].period_start, '2026-07-01');assert.equal(reports[0].payload.patients.morning, null);
});
test('known backup sheet is not reimported as another performance dataset', () => {
 const rows = [['Source test label', 'Morning', 'Evening', 'Night'], ['Test A', 2, 0, 0]];
 const reports = parseLabSheets([{ sheet: 'July 2026', data: [['Date', 'July 2026']] }, { sheet: 'Test counts', data: rows }, { sheet: 'Original source', data: rows }], 'synthetic.xlsx');
 assert.equal(reports.length, 1);assert.equal(reports[0].payload.tests[0].morning, 2);
});
test('missing month metadata is not recovered from a filename column', () => {
 const reports = parseLabSheets([{ sheet: 'Sheet 1', data: [['Source file', 'July 2026.pdf'], ['Test', 'Morning', 'Evening', 'Night'], ['Test A', 2, 0, 0]] }], 'synthetic.xlsx');
 assert.equal(reports[0].period_kind, null);
});
test('PKR parsing is exact to paisa and does not accept scientific notation', () => {
 assert.equal(rupeesToMinor('0.29'), 29);assert.equal(rupeesToMinor('1200.01'), 120001);
 assert.throws(() => rupeesToMinor('1e3'));assert.throws(() => rupeesToMinor('10.001'));assert.throws(() => rupeesToMinor('-1'));
});
test('Karachi date does not inherit UTC date near midnight', () => {
 assert.equal(karachiDate(new Date('2026-06-30T22:00:00Z')), '2026-07-01');
 assert.equal(medicalCentreInput.safeParse({ action: 'price', entity: 'doctor', entity_id: '00000000-0000-4000-8000-000000000001', valid_from: '2026-02-29', amount_minor: 1, currency: 'PKR', source_label: 'Synthetic date validation' }).success, false);
});
test('source scope defaults only to the actual main diagnostic centre', () => { assert.equal(month.laboratory_name, mainLaboratoryName); });
