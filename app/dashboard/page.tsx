import Link from 'next/link';
import { dashboardRows } from '@/lib/dashboard';
import { isConfigured } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Workspace from '@/components/workspace/Workspace';
import { allRoles } from '@/lib/actor-db';
export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
 if (!isConfigured()) return <main className="mx-auto max-w-xl px-6 py-16">
  <p className="text-xs font-bold uppercase tracking-widest text-emerald-900">Khidmat-e-Alam Welfare Trust</p>
  <h1 className="mt-4 font-serif text-3xl">Staff workspace unavailable</h1>
  <p role="alert" className="mt-5 text-slate-600">The secure staff backend has not been configured for this deployment. An administrator must complete setup before operational records can be accessed.</p>
  <Link href="/preview" className="mt-6 inline-block font-semibold text-emerald-900 underline">View the read-only source preview</Link>
 </main>;
 const access = await requireRole(allRoles).catch(() => null);
 if (!access) redirect('/login');
 const staff = ['admin', 'camp_manager', 'doctor', 'pharmacist'].includes(access.role);
 return <Workspace role={access.role} initialCamps={staff ? await dashboardRows(true) : []} initialSection={(await searchParams).section ?? 'overview'} />;
}
