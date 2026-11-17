import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourcePreviewRows } from '../lib/source-preview';
import historical from '../data/historical-camps.json';
import planned from '../data/planned-camps.json';

test('public preview includes every supplied camp once and no generated programme slots', () => {
 const rows = sourcePreviewRows();
 assert.deepEqual(rows.map(row => row.id), [...historical.map(c => c.id), ...planned.map(c => c.code)]);
 assert.equal(new Set(rows.map(row => row.id)).size, 12);
 assert.equal(rows.some(row => row.id === 'FMC-13'), false);
});
test('preview preserves historical totals without inventing live patient records', () => {
 const rows = sourcePreviewRows();
 assert.equal(rows.reduce((n, row) => n + row.patients, 0), 2912);
 assert.equal(rows.reduce((n, row) => n + row.spend, 0), 2416571);
 assert.equal(rows.reduce((n, row) => n + row.zakat, 0), 1863111);
 assert.equal(rows.reduce((n, row) => n + row.general, 0), 553460);
 assert(rows.every(row => row.livePatients === 0));
 for (const row of rows.filter(row => row.status === 'planned')) {
  assert.equal(row.date, null);
  assert.equal(row.maleRecorded, null);
  assert.equal(row.femaleRecorded, null);
  assert.equal(row.spend, 0);
  assert.match(row.dataNote ?? '', /No completed activity is asserted/);
 }
});
