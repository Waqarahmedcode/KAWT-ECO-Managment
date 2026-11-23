import test from 'node:test';
import assert from 'node:assert/strict';
import { csvValue, labPayloadSchema, labReportSchema, labTotals, validDate, validLabPeriod, type LabPayload } from '../lib/laboratory';
const source = (): LabPayload => ({
 tests: [{ label: 'CBC', morning: 2, evening: 3, night: 1 }, { label: 'ESR', morning: 1, evening: 0, night: 1 }],
 patients: { morning: 2, evening: 3, night: 1 },
 outsource: { patients: 1, tests: 2 },
 urgent: { morning: { patients: 1, tests: 1 }, evening: { patients: 0, tests: 0 }, night: { patients: 1, tests: 1 } },
});
test('dates reject impossible or ambiguous values and honor leap years', () => {
 for (const value of ['2-8-2026', '2026-02-29', '2026-13-01', '2026-04-31', '2026-7-01']) assert.equal(validDate(value), false, value);
 assert(validDate('2024-02-29'));
 assert(validLabPeriod('month', '2024-02-01', '2024-02-29'));
 assert(!validLabPeriod('month', '2026-07-02', '2026-07-31'));
 assert(!validLabPeriod('day', '2026-07-01', '2026-07-31'));
 assert(validLabPeriod('week', '2026-07-30', '2026-08-05'));
 assert(validLabPeriod('half_year', '2026-07-01', '2026-12-31'));
 assert(!validLabPeriod('half_year', '2026-06-01', '2026-11-30'));
 assert(validLabPeriod('year', '2026-01-01', '2026-12-31'));
});
test('supplementary referral counts never inflate main tests or reported patients', () => {
 const sums = labTotals(source());
 assert.equal(sums.testTotal, 8);
 assert.equal(sums.patientTotal, 6);
 assert.deepEqual(sums.urgent, { patients: 2, tests: 2 });
 assert.equal(sums.complete, true);
});
test('missing shifts stay null and never count as explicit zero tests', () => {
 const payload = source();payload.tests = [{ label: 'CBC', morning: 0, evening: null, night: null }];
 payload.patients.evening = null;payload.patients.night = null;
 assert(labPayloadSchema.safeParse(payload).success);
 const sums = labTotals(payload);assert.equal(sums.complete, false);assert.equal(sums.zero, 0);
 payload.tests[0].evening = 0;payload.tests[0].night = 0;assert.equal(labTotals(payload).zero, 1);
});
test('source imports cannot silently become day entries or accept invalid counts', () => {
 const value = { period_kind: 'month', period_start: '2026-07-01', period_end: '2026-07-31', source_label: 'July source', payload: source() };
 assert(labReportSchema.safeParse(value).success);
 assert(!labReportSchema.safeParse({ ...value, period_kind: 'day' }).success);
 const payload = source();payload.tests[0].morning = -1;assert(!labPayloadSchema.safeParse(payload).success);
 payload.tests[0].morning = 0.5;assert(!labPayloadSchema.safeParse(payload).success);
 payload.tests[0].morning = 0;payload.tests.push({ ...payload.tests[0], label: ' cbc ' });assert(!labPayloadSchema.safeParse(payload).success);
});
test('spreadsheet text is escaped against formula injection and quotes', () => {
 assert.equal(csvValue('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
 assert.equal(csvValue('CBC, ESR'), '"CBC, ESR"');
});

test('an entirely blank report is rejected while an explicit zero remains a real observation', () => {
 const blank: LabPayload = { tests: [{label:'CBC',morning:null,evening:null,night:null}], patients:{morning:null,evening:null,night:null}, outsource:{patients:null,tests:null}, urgent:{morning:{patients:null,tests:null},evening:{patients:null,tests:null},night:{patients:null,tests:null}} };
 assert.equal(labPayloadSchema.safeParse(blank).success, false);
 blank.tests[0].morning = 0;
 assert.equal(labPayloadSchema.safeParse(blank).success, true);
 assert.deepEqual(labTotals(blank).observed, {morning:true,evening:false,night:false});
});
