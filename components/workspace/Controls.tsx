'use client';
import { useEffect,useState, type ReactNode } from 'react';
import { str,type WorkspaceRow } from '@/lib/workspace-types';

export type Field={name:string;label:string;type?:'text'|'email'|'number'|'date'|'select'|'checkbox'|'textarea'|'tags';required?:boolean;options?:{value:string;label:string}[];value?:string|number|boolean;scale?:number;min?:number;max?:number;step?:string;help?:string};
export const control='w-full rounded-lg border border-[#cad9cf] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/25';
export const primary='rounded-lg bg-[#0B5D3B] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#08472e]';
export const secondary='rounded-lg border border-[#cbd9ce] bg-white px-3 py-2 text-sm font-semibold text-[#0B5D3B] disabled:opacity-50';

export async function api(url:string,body:unknown,method='POST'){
 const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok){
  const error=data.error;
  throw new Error(typeof error==='string'?error: error?.fieldErrors?Object.entries(error.fieldErrors).map(([k,v])=>`${k}: ${String(v)}`).join(' · '):'Please check the form and try again');
 }
 return data;
}

export function Card({title,children,description}:{title:string;children?:ReactNode;description?:string}){
 return <section className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm"><h2 className="font-serif text-xl font-bold text-[#123d2a]">{title}</h2>{description&&<p className="mt-2 text-sm leading-relaxed text-[#698071]">{description}</p>}<div className="mt-5">{children}</div></section>;
}

export function DataForm({title,fields,action,endpoint,method,initial,onSaved,onResult,prepare,description}:{title:string;fields:Field[];action?:string;endpoint?:string;method?:string;initial?:WorkspaceRow;onSaved:(message:string)=>void;onResult?:(result:Record<string,unknown>)=>void;prepare?:(values:Record<string,unknown>)=>Record<string,unknown>;description?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const form=event.currentTarget,raw=new FormData(form),values:Record<string,unknown>={};
  for(const field of fields){
   const value=raw.get(field.name);
   if(field.type==='checkbox')values[field.name]=value==='on';
   else if(!value&&!field.required)continue;
   else if(field.type==='number')values[field.name]=field.scale?Math.round(Number(value)*field.scale):Number(value);
   else if(field.type==='tags')values[field.name]=String(value??'').split(',').map(s=>s.trim()).filter(Boolean);
   else values[field.name]=String(value??'');
  }
  if(initial?.id)values.id=initial.id;
  try{const result=await api(endpoint??'/api/workspace',action?{action,data:prepare?prepare(values):values}:prepare?prepare(values):values,method);onSaved(initial?'Record updated.':'Record saved.');onResult?.(result);form.reset()}
  catch(err){setError(err instanceof Error?err.message:'Unable to save')}
  finally{setBusy(false)}
 }
 return <Card title={title} description={description}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
  {fields.map(field=>{
   const original=initial?.[field.name]??field.value;
   const value=field.type==='tags'&&Array.isArray(original)?original.join(', '):field.type==='date'?String(original??'').slice(0,10):field.scale&&original!=null?Number(original)/field.scale:original;
   return <label key={field.name} className={`block text-xs font-bold uppercase tracking-wide text-[#55715e] ${field.type==='textarea'?'sm:col-span-2':''}`}>
    {field.label}{field.required?' *':''}
    {field.type==='select'?<select name={field.name} defaultValue={String(value??'')} required={field.required} className={`${control} mt-1.5 normal-case font-normal`}><option value="">Select…</option>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:
     field.type==='checkbox'?<input name={field.name} type="checkbox" required={field.required} defaultChecked={Boolean(value)} className="ml-3 h-4 w-4 align-middle accent-[#0B5D3B]"/>:
     field.type==='textarea'?<textarea name={field.name} defaultValue={String(value??'')} required={field.required} rows={3} className={`${control} mt-1.5 normal-case font-normal`}/>:
     <input name={field.name} type={field.type==='tags'?'text':field.type??'text'} defaultValue={value==null?'':String(value)} required={field.required} min={field.min??(field.type==='number'?0:undefined)} max={field.max} step={field.step??(field.type==='number'?'any':undefined)} className={`${control} mt-1.5 normal-case font-normal`}/>}
    {field.help&&<span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-[#7b8b80]">{field.help}</span>}
   </label>;
  })}
  {error&&<p role="alert" className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <div className="sm:col-span-2"><button className={primary} disabled={busy}>{busy?'Saving…':initial?'Save changes':'Save record'}</button></div>
 </form></Card>;
}

export type Column={key:string;label:string;render?:(row:WorkspaceRow)=>ReactNode};
export function DataTable({title,rows,columns,actions,sourceTable}:{title:string;rows:WorkspaceRow[];columns:Column[];actions?:(row:WorkspaceRow)=>ReactNode;sourceTable?:string}){
 const [search,setSearch]=useState(''),[page,setPage]=useState(0);
 const remote=Boolean(sourceTable&&rows.length>=1000);
 const [result,setResult]=useState<{rows:WorkspaceRow[];total:number}|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  if(!remote)return;
  const controller=new AbortController();const timer=setTimeout(()=>{fetch(`/api/workspace?table=${sourceTable}&page=${page}&query=${encodeURIComponent(search)}`,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);setResult(data);setError('')}).catch(error=>{if(error.name!=='AbortError')setError(error.message)})},200);
  return()=>{controller.abort();clearTimeout(timer)};
 },[remote,sourceTable,page,search,rows]);
 const filtered=remote?(result?.rows??[]):rows.filter(row=>columns.map(c=>str(row,c.key)).join(' ').toLowerCase().includes(search.toLowerCase()));
 const total=remote?(result?.total??rows.length):filtered.length;
 const pages=Math.max(1,Math.ceil(total/20)),current=remote?page:Math.min(page,pages-1);
 const visible=remote?filtered:filtered.slice(current*20,current*20+20);
 return <Card title={title}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-[#617b68]">Search <input className={control} value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} aria-label={`Search ${title}`}/></label><span className="text-xs text-[#76877b]">{total} records{remote?' · database search and pagination':''}</span></div>
  {error&&<p role="alert" className="mb-3 text-sm text-red-800">{error}</p>}<div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead className="bg-[#f1f6f0] text-[11px] uppercase tracking-wider text-[#4c6d58]"><tr>{columns.map(c=><th className="whitespace-nowrap px-3 py-3" key={c.key}>{c.label}</th>)}{actions&&<th className="px-3 py-3">Actions</th>}</tr></thead><tbody>{visible.map((row,i)=><tr className="border-b border-[#e8eee7] align-top" key={str(row,'id')||i}>{columns.map(c=><td className="max-w-xs px-3 py-3" key={c.key}>{c.render?c.render(row):str(row,c.key)||'—'}</td>)}{actions&&<td className="px-3 py-3"><div className="flex flex-wrap gap-2">{actions(row)}</div></td>}</tr>)}</tbody></table>{!filtered.length&&<p className="p-6 text-center text-sm text-[#78907e]">No records yet. Saved records will appear here.</p>}</div>
  <div className="mt-4 flex items-center justify-end gap-3 text-xs text-[#66806d]"><button className={secondary} disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><span>{current+1} / {pages}</span><button className={secondary} disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next</button></div>
 </Card>;
}
