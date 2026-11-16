import { dashboardRows } from '@/lib/dashboard';
import { requireRole,authError } from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(){try{await requireRole(['admin','camp_manager','doctor','pharmacist']);return Response.json({camps:await dashboardRows(true)},{headers:{'Cache-Control':'no-store'}})}catch(e){return authError(e)}}
