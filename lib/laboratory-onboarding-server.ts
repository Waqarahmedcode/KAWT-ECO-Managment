import 'server-only';
import { ZodError } from 'zod';
import { workspaceError } from './actor-db';
export const onboardingHeaders = { 'Cache-Control': 'private, no-store' };
export function onboardingError(error: unknown) {
 if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Request ki details check karein' }, { status: 400, headers: onboardingHeaders });
 const response = workspaceError(error);response.headers.set('Cache-Control', 'private, no-store');return response;
}
export async function onboardingBody(request: Request) {
 const raw = await request.text();
 if (raw.length > 10_000) throw Object.assign(new Error('Request ki details bohat lambi hain'), { code: 'P0001' });
 try { return JSON.parse(raw) as unknown; }
 catch { throw Object.assign(new Error('Valid request darkar hai'), { code: 'P0001' }); }
}
