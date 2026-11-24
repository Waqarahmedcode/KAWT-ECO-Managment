import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { allRoles } from '@/lib/actor-db';
import DepartmentDirectory from '@/components/operations/DepartmentDirectory';
export const dynamic='force-dynamic';
export default async function Page(){await requireRole(allRoles).catch(()=>redirect('/login'));return <DepartmentDirectory/>;}
