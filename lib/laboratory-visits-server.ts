import 'server-only';
import { z } from 'zod';
import { workspaceError } from './actor-db';
import type { requireLabAccess } from './laboratory-server';
export const privateHeaders = { 'Cache-Control': 'private, no-store' };
export function scopedVisitLaboratory(actor: Awaited<ReturnType<typeof requireLabAccess>>, requested?: string) {
 const name = requested?.trim() || actor.laboratory_name;
 if (actor.access !== 'admin' && name.toLowerCase() !== actor.laboratory_name.trim().toLowerCase()) throw new Error('FORBIDDEN');
 return name;
}
export function visitError(error: unknown) {
 if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Entry check karein' }, { status: 400, headers: privateHeaders });
 if (error instanceof Error && error.message === 'SHIFT_REQUIRED') return Response.json({ error: 'Shift chunein; fixed hours abhi administrator ne configure nahin kiye' }, { status: 400, headers: privateHeaders });
 if (error instanceof Error && error.message === 'FUTURE_ENTRY') return Response.json({ error: 'Entry ka waqt mustaqbil ka nahin ho sakta; date/time check karein' }, { status: 400, headers: privateHeaders });
 const response = workspaceError(error);response.headers.set('Cache-Control', 'private, no-store');return response;
}
