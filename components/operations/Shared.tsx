'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
export const inputClass='mt-1 w-full min-w-0 rounded-lg border border-emerald-900/20 bg-white p-2.5 text-sm';
export const buttonClass='inline-block rounded-lg border border-emerald-900/20 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40';
export const panelClass='rounded-xl border border-emerald-900/10 bg-white p-5';
export async function operationApi(path:string,value?:unknown){
 const r=await fetch(path,value===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error??'Unable to complete request');return data;
}
export function OperationsShell({title,admin,children}:{title:string;admin:boolean;children:ReactNode}){
 const router=useRouter();
 return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 text-emerald-950"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest">Khidmat-e-Alam Welfare Trust</p><h1 className="mt-2 font-serif text-3xl">{title}</h1></div><nav className="no-print flex flex-wrap gap-2">{admin&&<Link className={buttonClass} href="/dashboard">Central dashboard</Link>}<Link className={buttonClass} href="/departments">Department workspaces</Link><button className={buttonClass} onClick={async()=>{await operationApi('/api/auth/session',{action:'signout'});router.replace('/login');router.refresh();}}>Sign out</button></nav></header>{children}</main>;
}
export function MetricTable({title,rows}:{title:string;rows:{label:string;count:number}[]}){
 return <section className={panelClass}><h2 className="font-serif text-xl">{title}</h2><table aria-label={title} className="mt-4 w-full text-left text-sm"><thead><tr><th className="py-2">Group</th><th className="py-2 text-right">Visits</th></tr></thead><tbody>{rows.map(r=><tr className="border-t" key={r.label}><td className="py-2">{r.label}</td><td className="py-2 text-right">{r.count}</td></tr>)}</tbody></table>{!rows.length&&<p className="mt-3 text-sm text-slate-600">No saved visits in this period.</p>}</section>;
}
