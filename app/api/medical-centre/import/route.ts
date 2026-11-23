import { z } from 'zod';
import { actorTransaction, sameOrigin, workspaceError } from '@/lib/actor-db';
import { medicalCentreSourceInput, importMedicalCentreSource } from '@/lib/medical-centre-import';
export async function POST(request: Request) {
 try {
  sameOrigin(request);const raw = await request.text();
  if (raw.length > 500_000) return Response.json({ error: 'Source file is too large' }, { status: 413 });
  let parsed: unknown;try { parsed = JSON.parse(raw); } catch { return Response.json({ error: 'Valid source JSON darkar hai' }, { status: 400 }); }
  const input = medicalCentreSourceInput.parse(parsed);
  const result = await actorTransaction(['admin', 'camp_manager'], (client, actor) => importMedicalCentreSource(client, actor.id, input));
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (error) {
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Source fields check karein' }, { status: 400 });
  return workspaceError(error);
 }
}
