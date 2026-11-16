'use client';
import { useState } from 'react';
import { zakatEstimate } from '@/lib/finance';
import { Card,control } from './Controls';
import { money } from '@/lib/workspace-types';
import { givingEvent } from '@/components/GivingAnalytics';

export function GivingCalculator(){
 const [values,setValues]=useState({cash:0,gold:0,silver:0,business:0,receivables:0,liabilities:0,nisab:0,heldLunarYear:false});
 const result=zakatEstimate(values);
 const names={cash:'Cash & savings',gold:'Gold value',silver:'Silver value',business:'Business assets',receivables:'Recoverable receivables',liabilities:'Eligible short-term liabilities',nisab:'Current nisab threshold'};
 return <Card title="Zakat planning calculator" description="Enter current values in PKR. Nisab and eligible assets/liabilities depend on your chosen standard and qualified guidance. No market rate is invented."><div className="grid gap-4 sm:grid-cols-2">{Object.entries(names).map(([key,label])=><label key={key} className="text-xs font-bold text-[#5a7563]">{label} (PKR)<input className={`${control} mt-2`} type="number" min={0} step=".01" value={values[key as keyof typeof names]} onChange={e=>setValues({...values,[key]:Math.max(0,Number.isFinite(Number(e.target.value))?Number(e.target.value):0)})}/></label>)}</div><label className="mt-5 flex items-center gap-3 text-sm"><input type="checkbox" checked={values.heldLunarYear} onChange={e=>setValues({...values,heldLunarYear:e.target.checked})}/>The eligible wealth has been held for a lunar year</label><div className="mt-6 grid gap-4 rounded-xl bg-[#edf5ee] p-5 sm:grid-cols-2"><div><p className="text-xs uppercase text-[#63806d]">Net eligible wealth</p><p className="mt-2 font-serif text-2xl">{money(result.net*100)}</p></div><div><p className="text-xs uppercase text-[#63806d]">Estimated Zakat</p><p className="mt-2 font-serif text-3xl text-[#0B5D3B]">{money(result.amount*100)}</p><p className="mt-2 text-xs text-[#6c8074]">{result.eligible?'2.5% planning estimate':'Enter a valid nisab and confirm the lunar-year condition'}</p></div></div><button className="mt-5 text-sm font-bold text-[#0B5D3B] underline" onClick={()=>givingEvent('calculator_completed',{currency:'PKR',value:result.amount,fund:'ZAKAT',method:'calculator'})}>Calculate Zakat</button></Card>;
}
