import { z } from 'zod';
export const labRequestStatuses = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
const laboratory = z.string().trim().min(1, 'Laboratory ka naam darj karein').max(180);
const access = z.enum(['operator', 'viewer']);
export const staffRequestInput = z.discriminatedUnion('action', [
 z.object({ action: z.literal('request'), laboratory_name: laboratory, requested_access: access, message: z.string().trim().max(1000) }).strict(),
 z.object({ action: z.literal('withdraw'), id: z.uuid(), revision: z.number().int().positive() }).strict(),
]);
export const staffDecisionInput = z.object({
 id: z.uuid(), revision: z.number().int().positive(), status: z.enum(['approved', 'rejected']),
 laboratory_name: laboratory.optional(), granted_access: access.optional(), current_grant_revision: z.number().int().positive().nullable().optional(),
 decision_note: z.string().trim().max(1000),
}).strict().superRefine((value, ctx) => {
 if (value.status === 'approved' && (!value.laboratory_name || !value.granted_access || value.current_grant_revision === undefined)) ctx.addIssue({ code: 'custom', message: 'Approve karne se pehle department, access aur latest record check karein' });
 if (value.status === 'rejected' && !value.decision_note) ctx.addIssue({ code: 'custom', path: ['decision_note'], message: 'Reject karne ki wajah darj karein' });
});
export type StaffRequest = {
 id: string; requester_email: string; requester_name: string; laboratory_name: string; requested_access: 'operator' | 'viewer';
 message: string; status: typeof labRequestStatuses[number]; revision: number; created_at: string; decided_at: string | null;
 decision_note: string; granted_access: 'operator' | 'viewer' | null; granted_laboratory_name: string | null; current_grant_revision?: number | null;
};
export type LabGrant = {
 user_id: string; email: string; display_name: string; profile_role: string; access: 'operator' | 'viewer';
 active: boolean; laboratory_name: string; revision: number; changed_at: string;
};
export type AccessChange = { entity_kind: string; action: string; changed_at: string; email: string | null; previous: Record<string, unknown> | null; current_value: Record<string, unknown> };
export function departmentSignupRedirect(origin: string) {
 const url = new URL('/auth/callback', origin);url.searchParams.set('next', '/lab/access');return url.toString();
}
