import { z } from 'zod';
import { validDate } from './laboratory';
const id = { id: z.uuid().optional(), revision: z.number().int().positive().optional() };
const status = z.enum(['draft', 'active', 'inactive']);
const source = z.string().trim().min(1).max(500);
const date = z.string().refine(validDate, 'Valid date darkar hai');
const doctor = z.object({
 action: z.literal('doctor'), ...id, name: z.string().trim().min(2).max(160), specialty: z.string().trim().min(2).max(160),
 qualifications: z.string().max(500), service_group: z.enum(['OPD', 'URGENT_CARE']), days_text: z.string().max(500), times_text: z.string().max(500),
 photo_url: z.string().max(1500).regex(/^https:\/\/(www\.)?khidmat-e-alam\.org\//).nullable(), status, source_label: source, effective_date: date.nullable(), notes: z.string().max(2000),
}).strict();
const packageSchema = z.object({ action: z.literal('package'), ...id, name: z.string().trim().min(2).max(160), components: z.array(z.string().trim().min(1).max(160)).min(1).max(100), status, source_label: source, notes: z.string().max(2000) }).strict();
const price = z.object({ action: z.literal('price'), entity: z.enum(['doctor', 'package']), entity_id: z.uuid(), valid_from: date, amount_minor: z.number().int().min(0).max(100_000_000_000), currency: z.literal('PKR'), source_label: source }).strict();
export const medicalCentreInput = z.discriminatedUnion('action', [doctor, packageSchema, price]).superRefine((value, ctx) => {
 if ('id' in value && value.id && !value.revision) ctx.addIssue({ code: 'custom', path: ['revision'], message: 'Edit se pehle latest record load karein' });
});
export function rupeesToMinor(value: string) {
 if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) throw new Error('Rupees mein valid amount aur zyada se zyada do decimal digits darj karein');
 const [whole, fraction = ''] = value.split('.');
 return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function karachiDate(now = new Date()) {
 const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
 const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
 return part('year') + '-' + part('month') + '-' + part('day');
}
export function sourceQuotedFee(notes: string) {
 const prefix = 'Source quoted charge: ', end = notes.indexOf('. Effective date not supplied');
 return notes.startsWith(prefix) && end > prefix.length ? notes.slice(prefix.length, end) : null;
}
