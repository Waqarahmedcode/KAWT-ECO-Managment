import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireLabAccess } from '@/lib/laboratory-server';
import LabPatientPortal from '@/components/laboratory/LabPatientPortal';
export const dynamic = 'force-dynamic';
export default async function LabVisitsPage() {
 let actor;
 try { actor = await requireLabAccess(); }
 catch (error) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') redirect('/lab/login');
  return <main className="mx-auto max-w-xl p-8"><h1 className="font-serif text-3xl">Lab access darkar hai</h1><p className="mt-4">Administrator se is department ka access hasil karein.</p></main>;
 }
 return <LabPatientPortal access={actor.access} laboratoryName={actor.laboratory_name} serverNow={new Date().toISOString()} initialId={randomUUID()} />;
}
