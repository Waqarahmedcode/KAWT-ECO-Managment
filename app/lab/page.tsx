import { redirect } from 'next/navigation';
import { requireLabAccess } from '@/lib/laboratory-server';
import LabWorkspace from '@/components/laboratory/LabWorkspace';
export const dynamic = 'force-dynamic';
export default async function LaboratoryPage() {
 let access: Awaited<ReturnType<typeof requireLabAccess>>;
 try { access = await requireLabAccess(); }
 catch (error) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') redirect('/lab/login');
  if (error instanceof Error && error.message === 'FORBIDDEN') redirect('/lab/access');
  return <main className="mx-auto max-w-xl px-6 py-20"><p className="text-sm font-bold text-emerald-900">KAWT · Laboratory</p><h1 className="mt-4 font-serif text-3xl">Lab access darkar hai</h1><p className="mt-4 text-slate-600">Is account ko laboratory ki permission nahin mili, ya department setup abhi available nahin. Administrator apne account se lab access assign kar sakta hai.</p><a className="mt-5 inline-block underline" href="/lab/login">Lab sign-in</a></main>;
 }
 if (access.access !== 'admin') redirect('/lab/visits');
 return <LabWorkspace access={access.access} laboratoryName={access.laboratory_name} />;
}
