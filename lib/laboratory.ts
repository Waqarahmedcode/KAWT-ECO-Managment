import { z } from 'zod';

export const labShifts = ['morning', 'evening', 'night'] as const;
export const mainLaboratoryName = 'Khidmat-e-Alam Diagnostic Centre';
export type LabShift = typeof labShifts[number];
export const labCount = z.number().int().min(0).max(99_999_999);
// Explicit null means not reported. It must never be converted into a zero.
const counts = z.object({ morning: labCount.nullable(), evening: labCount.nullable(), night: labCount.nullable() }).strict();
const pair = z.object({ patients: labCount.nullable(), tests: labCount.nullable() }).strict();
export const labPayloadSchema = z.object({
 tests: z.array(z.object({ label: z.string().trim().min(1).max(160), ...counts.shape }).strict()).min(1).max(500),
 patients: counts,
 outsource: pair,
 urgent: z.object({ morning: pair, evening: pair, night: pair }).strict(),
 notes: z.string().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
 const observed = value.tests.some(t => labShifts.some(shift => t[shift] !== null)) || labShifts.some(shift => value.patients[shift] !== null || value.urgent[shift].patients !== null || value.urgent[shift].tests !== null) || value.outsource.patients !== null || value.outsource.tests !== null;
 if (!observed) ctx.addIssue({ code: 'custom', path: ['tests'], message: 'Kam az kam ek asal count darj karein; khaali form report nahin hai' });
 const labels = value.tests.map(t => t.label.toLocaleLowerCase('en'));
 if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: 'Har test ki ek hi row honi chahiye', path: ['tests'] });
});
export type LabPayload = z.infer<typeof labPayloadSchema>;
export type LabPeriodKind = 'day' | 'week' | 'month' | 'half_year' | 'year';
export function validDate(value: string): boolean {
 if (!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + 'T00:00:00.000Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validLabPeriod(kind: LabPeriodKind, start: string, end: string): boolean {
 if (!validDate(start) || !validDate(end) || start > end) return false;
 const a = new Date(start + 'T00:00:00Z'), b = new Date(end + 'T00:00:00Z');
 const year = a.getUTCFullYear(), month = a.getUTCMonth();
 const iso = (d: Date) => d.toISOString().slice(0, 10);
 if (kind === 'day') return start === end;
 if (kind === 'week') return b.getTime() - a.getTime() === 6 * 86400000;
 if (kind === 'month') return a.getUTCDate() === 1 && end === iso(new Date(Date.UTC(year, month + 1, 0)));
 if (kind === 'half_year') return (month === 0 || month === 6) && a.getUTCDate() === 1 && end === iso(new Date(Date.UTC(year, month + 6, 0)));
 return start === year + '-01-01' && end === year + '-12-31';
}
export const labReportSchema = z.object({
 laboratory_name: z.string().trim().min(1).max(180).default(mainLaboratoryName),
 id: z.uuid().optional(),
 revision: z.number().int().positive().optional(),
 period_kind: z.enum(['day', 'week', 'month', 'half_year', 'year']),
 period_start: z.string(),
 period_end: z.string(),
 source_label: z.string().trim().min(1).max(240),
 entry_mode: z.enum(['manual', 'historical_import']).default('manual'),
 payload: labPayloadSchema,
}).strict().superRefine((value, ctx) => {
 if (!validLabPeriod(value.period_kind, value.period_start, value.period_end)) ctx.addIssue({ code: 'custom', path: ['period_start'], message: 'Asal period ki valid aur poori date range darj karein' });
 if (value.id && !value.revision) ctx.addIssue({ code: 'custom', path: ['revision'], message: 'Purani report edit karne se pehle latest version load karein' });
});
export type LabReportInput = z.infer<typeof labReportSchema>;
export type LabReport = LabReportInput & { id: string; revision: number; updated_at: string };
export function labTotals(payload: LabPayload) {
 const tests = Object.fromEntries(labShifts.map(s => [s, payload.tests.reduce((n, row) => n + (row[s] ?? 0), 0)])) as Record<LabShift, number>;
 const testTotal = labShifts.reduce((n, s) => n + tests[s], 0);
 const patientTotal = labShifts.reduce((n, s) => n + (payload.patients[s] ?? 0), 0);
 const urgent = labShifts.reduce((n, s) => ({ patients: n.patients + (payload.urgent[s].patients ?? 0), tests: n.tests + (payload.urgent[s].tests ?? 0) }), { patients: 0, tests: 0 });
 const complete = payload.tests.every(t => labShifts.every(s => t[s] !== null)) && labShifts.every(s => payload.patients[s] !== null);
 const observed = Object.fromEntries(labShifts.map(s => [s, payload.tests.some(t => t[s] !== null)])) as Record<LabShift, boolean>;
 const patientObserved = labShifts.some(s => payload.patients[s] !== null);
 const urgentObserved = labShifts.some(s => payload.urgent[s].patients !== null || payload.urgent[s].tests !== null);
 return { tests, testTotal, patientTotal, urgent, complete, observed, patientObserved, urgentObserved, active: payload.tests.filter(t => labShifts.some(s => (t[s] ?? 0) > 0)).length, zero: payload.tests.filter(t => labShifts.every(s => t[s] === 0)).length };
}
export function csvValue(value: string | number) {
 const text = String(value);
 return '"' + (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
}
