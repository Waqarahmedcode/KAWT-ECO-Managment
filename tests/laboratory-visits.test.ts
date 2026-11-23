import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { visitInput, entrySettingsInput, karachiClock, shiftAt, applicableEntrySettings, visitRange, visitSummaryPayload, type VisitSummary } from '../lib/laboratory-visits';
const input = () => ({ id: randomUUID(), patient_name: 'Isolated test person', patient_reference: '', occurred_at: '2026-01-31T19:01:00Z', shift: null, referral_source: 'IN_HOUSE', referral_name: '', payment_category: 'paid', panel_name: '', tests: [{ label: 'CBC', amount_minor: null, quantity: 1 }], notes: '', voided: false });
test('Pakistan calendar day and shift follow exact instant across midnight', () => {
 assert.deepEqual(karachiClock(new Date('2026-01-31T19:01:00Z')), { date: '2026-02-01', time: '00:01', seconds: '00' });
 const hours = { morning: '08:00', evening: '14:00', night: '20:00' };
 assert.equal(shiftAt('2026-02-01T02:59:59Z', hours), 'night');
 assert.equal(shiftAt('2026-02-01T03:00:00Z', hours), 'morning');
 assert.equal(shiftAt('2026-02-01T09:00:00Z', hours), 'evening');
 assert.equal(shiftAt('2026-02-01T15:00:00Z', hours), 'night');
 assert.equal(shiftAt('2026-02-01T15:00:00Z', null), null);
});
test('Patient entry requires name/reference, a real source test and positive quantity', () => {
 assert(visitInput.safeParse(input()).success);
 assert(!visitInput.safeParse({ ...input(), patient_name: '' }).success);
 assert(visitInput.safeParse({ ...input(), patient_name: '', patient_reference: 'Isolated reference' }).success);
 assert(!visitInput.safeParse({ ...input(), tests: [{ label: 'Invented test', amount_minor: null, quantity: 1 }] }).success);
 assert(!visitInput.safeParse({ ...input(), tests: [{ label: 'CBC', amount_minor: null, quantity: 0 }] }).success);
 assert(!visitInput.safeParse({ ...input(), tests: [...input().tests, ...input().tests] }).success);
 assert(!visitInput.safeParse({ ...input(), occurred_at: 'not a date' }).success);
 assert(!visitInput.safeParse({ ...input(), occurred_at: '2026-02-30T10:00:00Z' }).success);
});
test('Unknown reference price is null; explicit free price and repeated test quantity are preserved', () => {
 assert.equal(visitInput.parse(input()).tests[0].amount_minor, null);
 const value = visitInput.parse({ ...input(), tests: [{ label: 'CBC', amount_minor: 0, quantity: 2 }] });
 assert.equal(value.tests[0].amount_minor, 0);assert.equal(value.tests[0].quantity, 2);
 assert(!visitInput.safeParse({ ...input(), tests: [{ label: 'CBC', amount_minor: 1.25, quantity: 1 }] }).success);
});
test('MOU, welfare panel and cancelled entries need their source/reason', () => {
 assert(!visitInput.safeParse({ ...input(), referral_source: 'MOU' }).success);
 assert(!visitInput.safeParse({ ...input(), payment_category: 'panel' }).success);
 assert(!visitInput.safeParse({ ...input(), voided: true }).success);
 assert(visitInput.safeParse({ ...input(), referral_source: 'MOU', referral_name: 'Isolated partner', payment_category: 'panel', panel_name: 'Isolated welfare panel', voided: true, notes: 'Entered twice in the isolated test' }).success);
});
test('Actual shift settings require all three distinct times; no guessed defaults', () => {
 assert(entrySettingsInput.safeParse({ shift_starts: null, reference_prices: [] }).success);
 assert(!entrySettingsInput.safeParse({ shift_starts: { morning: '08:00', evening: '08:00', night: '20:00' }, reference_prices: [] }).success);
 assert(!entrySettingsInput.safeParse({ shift_starts: { morning: '08:00', evening: '', night: '20:00' }, reference_prices: [] }).success);
 assert(!entrySettingsInput.safeParse({ shift_starts: null, reference_prices: [{ label: 'CBC', amount_minor: 1 }, { label: 'CBC', amount_minor: 2 }] }).success);
 const settings = { valid_from: '2026-02-01', shift_starts: { morning: '08:00', evening: '14:00', night: '20:00' }, reference_prices: [], revision: 1 };
 assert.equal(applicableEntrySettings('2026-01-31T18:59:59Z', settings), null);
 assert.equal(applicableEntrySettings('2026-01-31T19:00:00Z', settings), settings);
 assert(!visitRange.safeParse({ start: '2026-02-30', end: '2026-03-01' }).success);
 assert(!visitRange.safeParse({ start: '2026-03-02', end: '2026-03-01' }).success);
});
test('Exports use saved visits/tests without re-adding MOU or emergency groups or inventing records', () => {
 const summary: VisitSummary = { visits: 2, tests_count: 3, shifts: [{ shift: 'night', visits: 2, tests_count: 3 }], tests: [{ label: 'CBC', morning: 0, evening: 0, night: 3, total: 3 }], referrals: [{ source: 'MOU', visits: 1, tests_count: 2 }, { source: 'URGENT_CARE:night', visits: 1, tests_count: 1 }], categories: [] };
 const payload = visitSummaryPayload(summary);assert.equal(payload.patients.night, 2);assert.equal(payload.tests[0].night, 3);assert.equal(payload.urgent.night.tests, 1);
 assert.throws(() => visitSummaryPayload({ ...summary, visits: 0, tests_count: 0, tests: [] }), /NO_SAVED_VISITS/);
});
