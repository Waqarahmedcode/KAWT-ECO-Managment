import Dashboard from '@/components/Dashboard';
import { dashboardRows } from '@/lib/dashboard';
import { isConfigured } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Workspace from '@/components/workspace/Workspace';
import { allRoles } from '@/lib/actor-db';
export const dynamic='force-dynamic';
export default async function DashboardPage({searchParams}:{searchParams:Promise<{section?:string}>}){
 if(isConfigured()){
  const access=await requireRole(allRoles).catch(()=>null);
  if(!access)redirect('/login');
  const staff=['admin','camp_manager','doctor','pharmacist'].includes(access.role);
  return <Workspace role={access.role} initialCamps={staff?await dashboardRows(true):[]} initialSection={(await searchParams).section??'overview'}/>;
 }
 const demo=!isConfigured();let role:'demo'|'admin'|'camp_manager'|'doctor'|'pharmacist'='demo';
 if(!demo){try{const r=await requireRole(['admin','camp_manager','doctor','pharmacist']);role=r.role as typeof role;}catch{redirect('/login')}}
 const rows=await dashboardRows(!demo);
 return <Dashboard initialCamps={rows} role={role} demo={demo}/>;
}
