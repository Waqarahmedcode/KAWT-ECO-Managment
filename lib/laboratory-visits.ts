import { z } from 'zod';
import catalogue from '@/data/laboratory-catalogue.json';
import { labShifts, validDate, type LabShift, type LabPayload } from './laboratory';

export const visitReferrals = ['IN_HOUSE', 'MOU', 'URGENT_CARE', 'EXTERNAL'] as const;
export const visitCategories = ['paid', 'free', 'subsidized', 'panel'] as const;
export const testLabels = new Set(catalogue.map(test => test.label));
const amount = z.number().int().min(0).max(100_000_000_000).nullable();
const referenceTest = z.object({ label: z.string().refine(label => testLabels.has(label), 'Di hui catalogue se test chunein'), amount_minor: amount }).strict();
const tests = z.array(referenceTest.extend({ quantity: z.number().int().min(1).max(100).default(1) }).strict()).min(1).max(100).refine(rows => new Set(rows.map(row => row.label)).size === rows.length, 'Test aik hi martaba chunein');
export const visitInput = z.object({
 id: z.uuid(), revision: z.number().int().positive().optional(), laboratory_name: z.string().trim().min(1).max(180).optional(),
 patient_name: z.string().trim().max(160), patient_reference: z.string().trim().max(100),
 occurred_at: z.iso.datetime({ offset: true }), shift: z.enum(labShifts).nullable(),
 referral_source: z.enum(visitReferrals), referral_name: z.string().trim().max(160),
 payment_category: z.enum(visitCategories), panel_name: z.string().trim().max(160),
 tests, notes: z.string().trim().max(1000), voided: z.boolean(),
}).strict().superRefine((value, ctx) => {
 if (!value.patient_name && !value.patient_reference) ctx.addIssue({ code: 'custom', path: ['patient_name'], message: 'Patient ka naam ya reference number darj karein' });
 if (value.referral_source === 'MOU' && !value.referral_name) ctx.addIssue({ code: 'custom', path: ['referral_name'], message: 'MOU partner ka naam darj karein' });
 if (value.payment_category === 'panel' && !value.panel_name) ctx.addIssue({ code: 'custom', path: ['panel_name'], message: 'Panel ka naam darj karein' });
 if (value.voided && !value.notes) ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Entry cancel karne ki wajah notes mein darj karein' });
 const instant = new Date(value.occurred_at);
 if (!validDate(value.occurred_at.slice(0, 10)) || !Number.isFinite(instant.getTime()) || !validDate(karachiClock(instant).date)) ctx.addIssue({ code: 'custom', path: ['occurred_at'], message: 'Asal aur valid tareekh darj karein' });
});
export type VisitInput = z.infer<typeof visitInput>;
export type VisitRecord = Omit<VisitInput, 'laboratory_name' | 'revision'> & { laboratory_name: string; revision: number; service_date: string; automatic_shift: boolean; updated_at: string };
export const entrySettingsInput = z.object({
 laboratory_name: z.string().trim().min(1).max(180).optional(), revision: z.number().int().positive().optional(),
 valid_from: z.string().refine(validDate, 'Valid from ki asal date darj karein').nullable().default(null),
 shift_starts: z.object({ morning: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), evening: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), night: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict().nullable(),
 reference_prices: z.array(referenceTest).max(100),
}).strict().superRefine((value, ctx) => {
 if ((value.shift_starts || value.reference_prices.length) && !value.valid_from) ctx.addIssue({ code: 'custom', path: ['valid_from'], message: 'Shift hours / reference rates kis date se valid hain, darj karein' });
 if (value.shift_starts && new Set(Object.values(value.shift_starts)).size !== 3) ctx.addIssue({ code: 'custom', path: ['shift_starts'], message: 'Har shift ka alag start time darkar hai' });
 if (new Set(value.reference_prices.map(row => row.label)).size !== value.reference_prices.length) ctx.addIssue({ code: 'custom', path: ['reference_prices'], message: 'Har test ka aik reference rate rakhein' });
});
export type EntrySettings = z.infer<typeof entrySettingsInput> & { revision: number };
export function applicableEntrySettings(occurred: string, settings: EntrySettings | null) {
 return settings?.valid_from && karachiClock(new Date(occurred)).date >= settings.valid_from ? settings : null;
}
export function karachiClock(now = new Date()) {
 const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
 const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
 return { date: get('year') + '-' + get('month') + '-' + get('day'), time: get('hour') + ':' + get('minute'), seconds: get('second') };
}
export function shiftAt(occurred: string, starts: EntrySettings['shift_starts']): LabShift | null {
 if (!starts) return null;
 const time = karachiClock(new Date(occurred)).time;
 const sorted = labShifts.map(shift => ({ shift, start: starts[shift] })).sort((a, b) => a.start.localeCompare(b.start));
 return [...sorted].reverse().find(row => row.start <= time)?.shift ?? sorted[sorted.length - 1].shift;
}
export const visitRange = z.object({
 start: z.string().refine(validDate), end: z.string().refine(validDate), laboratory_name: z.string().trim().min(1).max(180).optional(),
}).superRefine((value, ctx) => {
 if (value.start > value.end || (Date.parse(value.end) - Date.parse(value.start)) / 86400000 > 3660) ctx.addIssue({ code: 'custom', message: 'Valid range chunein; zyada se zyada 10 saal', path: ['end'] });
});
export type VisitSummary = {
 visits: number; tests_count: number;
 shifts: { shift: LabShift; visits: number; tests_count: number }[];
 tests: { label: string; morning: number; evening: number; night: number; total: number }[];
 referrals: { source: string; visits: number; tests_count: number }[];
 categories: { category: string; visits: number; tests_count: number }[];
};
export function visitSummaryPayload(summary: VisitSummary): LabPayload {
 if (!summary.tests.length) throw new Error('NO_SAVED_VISITS');
 const pair = (source: string, shift?: LabShift) => {
  const row = summary.referrals.find(row => row.source === source + (shift ? ':' + shift : ''));
  return { patients: row?.visits ?? 0, tests: row?.tests_count ?? 0 };
 };
 return {
  tests: summary.tests.map(row => ({ label: row.label, morning: row.morning, evening: row.evening, night: row.night })),
  patients: Object.fromEntries(labShifts.map(shift => [shift, summary.shifts.find(row => row.shift === shift)?.visits ?? 0])) as LabPayload['patients'],
  outsource: pair('EXTERNAL'), urgent: { morning: pair('URGENT_CARE', 'morning'), evening: pair('URGENT_CARE', 'evening'), night: pair('URGENT_CARE', 'night') },
  notes: 'Saved patient/test entries only. Patients are visits, not verified unique persons. MOU and other referral groups are subsets; never add them again. Imported aggregate source reports remain separate. No patient names are exported.',
 };
}
