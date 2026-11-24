import { z } from 'zod';
import { validDate } from './laboratory';
export const departments = ['opd', 'urgent-care'] as const;
export type Department = typeof departments[number];
export const departmentNames = { opd: 'OPD', 'urgent-care': '24/7 Urgent Care' };
export const departmentGroups = { opd: 'OPD', 'urgent-care': 'URGENT_CARE' };
export const departmentSchema = z.enum(departments);
export const periodInput = z.object({ start: z.string().refine(validDate, 'Choose a real start date'), end: z.string().refine(validDate, 'Choose a real end date') }).refine(v => v.start <= v.end && (Date.parse(v.end) - Date.parse(v.start)) / 86400000 <= 3660, 'Choose a date range of at most ten years');
const amount = z.number().int().min(0).max(100_000_000_000).nullable();
export const departmentVisitInput = z.object({
 id: z.uuid(), revision: z.number().int().positive().optional(), department: departmentSchema,
 patient_name: z.string().trim().max(160), patient_reference: z.string().trim().max(100),
 occurred_at: z.iso.datetime({ offset: true }).refine(v => validDate(v.slice(0, 10)), 'Choose a real date'),
 shift: z.enum(['morning', 'evening', 'night']), doctor_id: z.uuid().nullable(),
 service: z.string().trim().min(1).max(160), referral_source: z.enum(['IN_HOUSE', 'EXTERNAL', 'MOU']), referral_name: z.string().trim().max(160),
 payment_category: z.enum(['paid', 'free', 'subsidized', 'panel']), panel_name: z.string().trim().max(160),
 reference_amount_minor: amount, support_amount_minor: amount, notes: z.string().trim().max(2000), voided: z.boolean(),
}).strict().superRefine((v, ctx) => {
 if (!v.patient_name && !v.patient_reference) ctx.addIssue({ code: 'custom', message: 'Enter a patient name or reference' });
 if (v.department === 'opd' && !v.doctor_id) ctx.addIssue({ code: 'custom', message: 'Select an OPD doctor' });
 if (v.referral_source === 'MOU' && !v.referral_name) ctx.addIssue({ code: 'custom', message: 'Enter the MOU partner' });
 if (v.payment_category === 'panel' && !v.panel_name) ctx.addIssue({ code: 'custom', message: 'Enter the welfare panel' });
 if (v.support_amount_minor !== null && (v.reference_amount_minor === null || v.support_amount_minor > v.reference_amount_minor)) ctx.addIssue({ code: 'custom', message: 'Support requires a known reference amount and cannot exceed it' });
 if (v.voided && !v.notes) ctx.addIssue({ code: 'custom', message: 'Record the cancellation reason' });
});
export type DepartmentVisit = z.infer<typeof departmentVisitInput> & { revision: number; service_date: string; doctor_name: string | null };
export type DepartmentSummary = { visits: number; by_shift: { label: string; count: number }[]; by_category: { label: string; count: number }[]; by_doctor: { label: string; count: number }[]; by_service: { label: string; count: number }[] };
export const departmentGrantInput = z.object({ email: z.string().trim().email(), department: departmentSchema, access: z.enum(['operator', 'viewer']), active: z.boolean(), revision: z.number().int().positive().nullable() }).strict();
