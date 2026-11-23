import { z } from 'zod';
import { labShifts, labTotals, mainLaboratoryName, validDate, validLabPeriod, type LabPayload, type LabReport } from './laboratory';
export const labSummaryQuery = z.object({
 kind: z.enum(['day', 'week', 'month', 'half_year', 'year', 'custom']),
 start: z.string(), end: z.string(),
 laboratory_name: z.string().trim().min(1).max(180).default(mainLaboratoryName),
}).strict().superRefine((value, ctx) => {
 const days = (Date.parse(value.end + 'T00:00:00Z') - Date.parse(value.start + 'T00:00:00Z')) / 86400000;
 const valid = value.kind === 'custom' ? validDate(value.start) && validDate(value.end) && days >= 0 && days <= 3660 : validLabPeriod(value.kind, value.start, value.end);
 if (!valid) ctx.addIssue({ code: 'custom', path: ['start'], message: 'Valid report dates chunein; custom range zyada se zyada 10 saal ho sakti hai' });
});
export type LabSummaryQuery = z.infer<typeof labSummaryQuery>;
const add = (a: number | null, b: number | null): number | null => a === null && b === null ? null : (a ?? 0) + (b ?? 0);
function dateKeys(start: string, end: string) {
 const result: string[] = [];
 for (let time = Date.parse(start + 'T00:00:00Z'), last = Date.parse(end + 'T00:00:00Z'); time <= last; time += 86400000) result.push(new Date(time).toISOString().slice(0, 10));
 return result;
}
function emptyPayload(): LabPayload {
 return { tests: [], patients: { morning: null, evening: null, night: null }, outsource: { patients: null, tests: null }, urgent: { morning: { patients: null, tests: null }, evening: { patients: null, tests: null }, night: { patients: null, tests: null } } };
}
/** Larger complete source snapshots take precedence over their contained detail.
 * A monthly/yearly snapshot is never split to fabricate a daily observation. */
export function summarizeLabReports(input: LabReport[], query: LabSummaryQuery) {
 const reports = input.filter(r => r.laboratory_name.trim().toLowerCase() === query.laboratory_name.toLowerCase() && r.period_start >= query.start && r.period_end <= query.end);
 const overlaps = (a: LabReport, b: LabReport) => a.period_start <= b.period_end && a.period_end >= b.period_start;
 const exact = reports.find(r => r.period_start === query.start && r.period_end === query.end && r.period_kind === query.kind)
  ?? reports.find(r => r.period_start === query.start && r.period_end === query.end);
 const selected: LabReport[] = [];
 if (exact) selected.push(exact);
 else {
  for (const kind of ['year', 'half_year', 'month', 'week', 'day'] as const) {
   const candidates = reports.filter(r => r.period_kind === kind).sort((a, b) => a.period_start.localeCompare(b.period_start));
   for (const report of candidates) {
    // Inconsistent overlapping weekly snapshots require explicit resolution.
    if (kind === 'week' && candidates.some(other => other.id !== report.id && overlaps(other, report))) continue;
    if (!selected.some(other => overlaps(other, report))) selected.push(report);
   }
  }
 }
 const days = dateKeys(query.start, query.end), covered = new Set<string>();
 for (const report of selected) for (const date of dateKeys(report.period_start, report.period_end)) covered.add(date);
 const uncovered = days.filter(day => !covered.has(day));
 if (!selected.length) return { query, found: false as const, message: 'Is tareekh ya period ka data available nahin', sources: [], missing_dates: uncovered };
 const payload = emptyPayload();
 const tests = new Map<string, LabPayload['tests'][number]>();
 for (const report of selected) {
  for (const row of report.payload.tests) {
   const key = row.label.trim().toLocaleLowerCase('en');
   const target = tests.get(key) ?? { label: row.label, morning: null, evening: null, night: null };
   for (const shift of labShifts) target[shift] = add(target[shift], row[shift]);
   tests.set(key, target);
  }
  for (const shift of labShifts) {
   payload.patients[shift] = add(payload.patients[shift], report.payload.patients[shift]);
   for (const kind of ['patients', 'tests'] as const) payload.urgent[shift][kind] = add(payload.urgent[shift][kind], report.payload.urgent[shift][kind]);
  }
  for (const kind of ['patients', 'tests'] as const) payload.outsource[kind] = add(payload.outsource[kind], report.payload.outsource[kind]);
 }
 payload.tests = [...tests.values()];
 payload.notes = 'Calculated from ' + selected.length + ' non-overlapping source reports. Monthly/yearly values were not split into daily entries. Main, outsource and emergency referral counts remain separate. Source-covered period does not prove independently observed daily detail.';
 const testCoverage = payload.tests.map(row => {
  const complete = !uncovered.length && selected.every(report => {
   const match = report.payload.tests.find(t => t.label.trim().toLocaleLowerCase('en') === row.label.trim().toLocaleLowerCase('en'));
   return match && labShifts.every(s => match[s] !== null);
  });
  return { label: row.label, complete, verified_zero: complete && labShifts.every(s => row[s] === 0) };
 });
 const stats = labTotals(payload);
 return {
  query, found: true as const, payload, stats,
  complete_source_coverage: !uncovered.length,
  complete_counts: selected.every(r => labTotals(r.payload).complete),
  sources: selected.map(r => ({ id: r.id, kind: r.period_kind, start: r.period_start, end: r.period_end, label: r.source_label, revision: r.revision })),
  missing_dates: uncovered, actual_daily_dates: reports.filter(r => r.period_kind === 'day').map(r => r.period_start),
  selected_daily_dates: selected.filter(r => r.period_kind === 'day').map(r => r.period_start),
  overlapping_detail_sources: reports.filter(r => !selected.some(s => s.id === r.id)).map(r => ({ kind: r.period_kind, start: r.period_start, end: r.period_end })),
  test_coverage: testCoverage, verified_zero_tests: testCoverage.filter(t => t.verified_zero).map(t => t.label),
 };
}
export type LabSummary = ReturnType<typeof summarizeLabReports> & { related_aggregate?: { period_kind: string; period_start: string; period_end: string } };
