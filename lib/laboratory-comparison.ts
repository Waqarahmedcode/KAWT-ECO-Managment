import { labShifts, validLabPeriod, type LabShift } from './laboratory';
import { labSummaryQuery, type LabSummary, type LabSummaryQuery } from './laboratory-reporting';

export type ComparisonMode = 'previous_period' | 'previous_year' | 'custom';
type Present = Extract<LabSummary, { found: true }>;
const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const periodDays = (query: LabSummaryQuery) => Math.round((Date.parse(query.end + 'T00:00:00Z') - Date.parse(query.start + 'T00:00:00Z')) / dayMs) + 1;
const key = (label: string) => label.trim().toLocaleLowerCase('en');

export function comparisonQuery(current: LabSummaryQuery, mode: ComparisonMode, manual?: { start: string; end: string }): { query: LabSummaryQuery | null; reason?: string } {
 const start = new Date(current.start + 'T00:00:00Z'), year = start.getUTCFullYear(), month = start.getUTCMonth();
 let previousStart = '', previousEnd = '', kind = current.kind;
 if (mode === 'custom') {
  previousStart = manual?.start ?? '';previousEnd = manual?.end ?? '';
  if (kind !== 'custom' && !validLabPeriod(kind, previousStart, previousEnd)) kind = 'custom';
 } else if (mode === 'previous_year') {
  const priorYear = String(year - 1);
  previousStart = priorYear + current.start.slice(4);
  previousEnd = String(Number(current.end.slice(0, 4)) - 1) + current.end.slice(4);
  if (kind === 'month') previousEnd = iso(new Date(Date.UTC(year - 1, month + 1, 0)));
 } else if (kind === 'month' || kind === 'half_year' || kind === 'year') {
  const months = kind === 'month' ? 1 : kind === 'half_year' ? 6 : 12;
  previousStart = iso(new Date(Date.UTC(year, month - months, 1)));
  previousEnd = iso(new Date(start.getTime() - dayMs));
 } else {
  previousEnd = iso(new Date(start.getTime() - dayMs));
  previousStart = iso(new Date(start.getTime() - periodDays(current) * dayMs));
 }
 const parsed = labSummaryQuery.safeParse({ kind, start: previousStart, end: previousEnd, laboratory_name: current.laboratory_name });
 if (!parsed.success) return { query: null, reason: 'Is comparison ki exact dates valid nahin. Manual range chunein; leap-day ya week ki dates khud adjust nahin ki gayin.' };
 if (parsed.data.start <= current.end && parsed.data.end >= current.start) return { query: null, reason: 'Comparison ke liye alag, non-overlapping period chunein.' };
 return { query: parsed.data };
}

export type ChangeStatus = 'ready' | 'new_activity' | 'no_activity' | 'missing_data' | 'partial_data' | 'different_periods' | 'different_tests';
export type VolumeChange = { current: number | null; previous: number | null; change: number | null; percent: number | null; status: ChangeStatus; note: string };
export const changeNotes: Record<ChangeStatus, string> = {
 ready: 'Mukammal reported volume ka farq',
 new_activity: 'Pichla count explicit zero tha; percentage available nahin',
 no_activity: 'Dono periods mein explicit zero',
 missing_data: 'Dono taraf reported count chahiye; missing ko zero nahin maana',
 partial_data: 'Source ya count coverage adhoori hai; growth nahin nikali',
 different_periods: 'Periods ki qisam ya manual range ki lambai alag hai',
 different_tests: 'Report ki test list badli hai; total growth comparable nahin',
};
export function volumeChange(current: number | null, previous: number | null, currentComplete: boolean, previousComplete: boolean, blocker?: 'different_periods' | 'different_tests'): VolumeChange {
 let status: ChangeStatus;
 if (current === null || previous === null) status = 'missing_data';
 else if (!currentComplete || !previousComplete) status = 'partial_data';
 else if (blocker) status = blocker;
 else if (previous === 0) status = current === 0 ? 'no_activity' : 'new_activity';
 else status = 'ready';
 const valid = ['ready', 'new_activity', 'no_activity'].includes(status);
 return { current, previous, change: valid ? current! - previous! : null, percent: status === 'ready' ? (current! - previous!) / previous! * 100 : status === 'no_activity' ? 0 : null, status, note: changeNotes[status] };
}
function count(sum: Present | undefined, label: string, shift?: LabShift) {
 const row = sum?.payload.tests.find(t => key(t.label) === key(label));
 if (!row || (shift ? row[shift] === null : !labShifts.some(s => row[s] !== null))) return null;
 return shift ? row[shift] : labShifts.reduce((total, s) => total + (row[s] ?? 0), 0);
}
function covered(sum: Present | undefined, label: string, shift?: LabShift) {
 const row = sum?.test_coverage.find(t => key(t.label) === key(label));
 return Boolean(row && (shift ? row.shifts[shift] : row.complete));
}
export function compareLabPeriods(current: LabSummary, previous: LabSummary) {
 const a = current.found ? current : undefined, b = previous.found ? previous : undefined;
 if (key(current.query.laboratory_name) !== key(previous.query.laboratory_name)) throw new Error('COMPARISON_LABORATORY_MISMATCH');
 if (previous.query.start <= current.query.end && previous.query.end >= current.query.start) throw new Error('COMPARISON_PERIODS_OVERLAP');
 const samePeriod = current.query.kind === previous.query.kind && (current.query.kind !== 'custom' || periodDays(current.query) === periodDays(previous.query));
 const aKeys = (a?.payload.tests ?? []).map(t => key(t.label)).sort(), bKeys = (b?.payload.tests ?? []).map(t => key(t.label)).sort();
 const sameTests = aKeys.length === bKeys.length && aKeys.every((value, i) => value === bKeys[i]);
 const periodBlock = samePeriod ? undefined : 'different_periods' as const;
 const totalBlock = periodBlock ?? (sameTests ? undefined : 'different_tests' as const);
 const patientComplete = (s: Present | undefined, shift?: LabShift) => Boolean(s && (shift ? s.patient_coverage[shift] : labShifts.every(x => s.patient_coverage[x])));
 const testsComplete = (s: Present | undefined, shift?: LabShift) => Boolean(s && s.test_coverage.length && s.test_coverage.every(t => shift ? t.shifts[shift] : t.complete));
 const testsObserved = (s: Present | undefined) => s && labShifts.some(x => s.stats.observed[x]) ? s.stats.testTotal : null;
 const totals = [
  { label: 'Reported tests', ...volumeChange(testsObserved(a), testsObserved(b), testsComplete(a), testsComplete(b), totalBlock) },
  { label: 'Reported patient count', ...volumeChange(a?.stats.patientObserved ? a.stats.patientTotal : null, b?.stats.patientObserved ? b.stats.patientTotal : null, patientComplete(a), patientComplete(b), periodBlock) },
 ];
 const shifts = labShifts.map(shift => ({ shift,
  tests: volumeChange(a?.stats.observed[shift] ? a.stats.tests[shift] : null, b?.stats.observed[shift] ? b.stats.tests[shift] : null, testsComplete(a, shift), testsComplete(b, shift), totalBlock),
  patients: volumeChange(a?.payload.patients[shift] ?? null, b?.payload.patients[shift] ?? null, patientComplete(a, shift), patientComplete(b, shift), periodBlock),
 }));
 const labels = new Map<string, string>();
 for (const row of [...(a?.payload.tests ?? []), ...(b?.payload.tests ?? [])]) if (!labels.has(key(row.label))) labels.set(key(row.label), row.label);
 const tests = [...labels.values()].sort((x, y) => x.localeCompare(y)).map(label => ({ label,
  ...volumeChange(count(a, label), count(b, label), covered(a, label), covered(b, label), periodBlock),
 }));
 return {
  current: { ...current.query, found: current.found, days: periodDays(current.query), sources: current.sources.length },
  previous: { ...previous.query, found: previous.found, days: periodDays(previous.query), sources: previous.sources.length },
  totals, shifts, tests, sameTests, samePeriod,
  note: 'Sirf reported volume ka comparison hai, clinical quality ya prediction nahin. Calendar months ke din alag ho sakte hain. Patient counts unique individuals nahin; Outsource/Emergency ko main totals mein dobara add nahin kiya.',
 };
}
export type LabComparison = ReturnType<typeof compareLabPeriods>;
