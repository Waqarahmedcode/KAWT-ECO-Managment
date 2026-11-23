import { redirect } from 'next/navigation';
import { requireLabAccess } from '@/lib/laboratory-server';
import LabAnalytics from '@/components/laboratory/LabAnalytics';
export const dynamic = 'force-dynamic';
export default async function LabReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
 let actor;
 try { actor = await requireLabAccess(); }
 catch (error) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') redirect('/lab/login');
  return <main className="mx-auto max-w-xl p-8"><h1 className="font-serif text-3xl">Lab access darkar hai</h1><p className="mt-4">Is account ko laboratory reporting ki permission nahin mili.</p></main>;
 }
 const params = await searchParams, single = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
 return <LabAnalytics key={single('kind') + single('start') + single('end') + single('laboratory_name')} laboratoryName={actor.laboratory_name} canChooseLaboratory={actor.access === 'admin'} initial={{ kind: single('kind'), start: single('start'), end: single('end'), laboratory_name: single('laboratory_name') }} />;
}
