import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import LeadManagement from '@/components/operations/LeadManagement';
export const dynamic='force-dynamic';
export default async function Page(){try{await requireRole(['admin']);}catch(e){if((e as Error).message==='UNAUTHENTICATED')redirect('/login');return <main className="p-8"><h1>Administrator access required</h1><Link href="/departments">Assigned workspaces</Link></main>;}return <LeadManagement/>;}
