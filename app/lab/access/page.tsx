import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { allRoles } from '@/lib/actor-db';
import { AdminLabAccess, StaffLabRequest } from '@/components/laboratory/LabAccessWorkspace';
export const dynamic = 'force-dynamic';
export default async function LabAccessPage() {
 let actor;
 try { actor = await requireRole(allRoles); }
 catch (error) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') redirect('/lab/login');
  return <main className="mx-auto max-w-xl p-8"><h1 className="font-serif text-3xl">Account setup darkar hai</h1><p className="mt-4">Apne administrator se rabta karein.</p></main>;
 }
 return actor.role === 'admin' ? <AdminLabAccess /> : <StaffLabRequest />;
}
