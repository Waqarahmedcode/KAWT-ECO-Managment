import { z } from 'zod';
import { validDate } from './laboratory';
export const leadStages = ['new', 'contacted', 'qualified', 'converted', 'do_not_contact', 'needs_secure_lookup', 'review_consent'] as const;
export const leadInput = z.object({
 id: z.uuid(), revision: z.number().int().positive().optional(), full_name: z.string().trim().min(1).max(140),
 email: z.union([z.literal(''), z.email()]), phone: z.string().trim().max(40),
 provider: z.enum(['manual', 'meta', 'tiktok', 'direct', 'email', 'whatsapp', 'event']), campaign_ref: z.string().trim().max(160),
 marketing_consent: z.boolean(), consent_basis: z.string().trim().min(1).max(1000), contact_status: z.enum(leadStages),
 assigned_to: z.uuid().nullable(), next_follow_up: z.string().refine(validDate).nullable(),
 linked_donor_id: z.uuid().nullable(), notes: z.string().trim().max(2000),
}).strict().superRefine((v, ctx) => {
 if (!v.marketing_consent && ['contacted', 'qualified', 'converted'].includes(v.contact_status)) ctx.addIssue({ code: 'custom', message: 'Record consent before progressing a lead' });
 if (v.contact_status === 'converted' && !v.linked_donor_id) ctx.addIssue({ code: 'custom', message: 'Link a donor with a confirmed contribution before marking converted' });
 if (v.next_follow_up && (!v.marketing_consent || v.contact_status === 'do_not_contact')) ctx.addIssue({ code: 'custom', message: 'Do-not-contact leads cannot have a scheduled follow-up' });
});
export type LeadInput = z.infer<typeof leadInput>;
export type LeadRecord = LeadInput & { revision: number; submitted_at: string; verified_conversion: boolean };
