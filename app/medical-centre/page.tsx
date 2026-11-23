import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import MedicalCentre from '@/components/medical-centre/MedicalCentre';
export const dynamic = 'force-dynamic';
export default async function MedicalCentrePage() {
 let actor;
 try { actor = await requireRole(['admin', 'camp_manager', 'doctor']); }
 catch (error) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') redirect('/login');
  return <main className="mx-auto max-w-xl p-8"><h1 className="font-serif text-3xl">Medical Centre access darkar hai</h1><p className="mt-4">Is account ko OPD/doctors configuration ka access nahin hai.</p></main>;
 }
 return <MedicalCentre canEdit={actor.role === 'admin' || actor.role === 'camp_manager'} canUseLab={actor.role === 'admin'} />;
}
