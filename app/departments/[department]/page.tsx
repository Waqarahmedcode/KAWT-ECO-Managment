import { redirect,notFound } from 'next/navigation';
import Link from 'next/link';
import { departmentSchema } from '@/lib/departments';
import { departmentTransaction } from '@/lib/department-server';
import DepartmentWorkspace from '@/components/operations/DepartmentWorkspace';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{department:string}>}){
 const parsed=departmentSchema.safeParse((await params).department);if(!parsed.success)notFound();
 try{await departmentTransaction(parsed.data,false,async()=>null);}catch(e){if((e as Error).message==='UNAUTHENTICATED')redirect('/login');if((e as Error).message!=='FORBIDDEN')throw e;return <main className="p-8"><h1>Department access required</h1><Link href="/departments">Return to assigned workspaces</Link></main>;}
 return <DepartmentWorkspace department={parsed.data}/>;
}
