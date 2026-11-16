'use client';
import { useState } from 'react';
import { Card,control } from './Controls';
import { money } from '@/lib/workspace-types';
export function SponsorshipPlanner(){
 const [count,setCount]=useState(1),[budget,setBudget]=useState(158000);
 return <Card title="Camp sponsorship planner" description="Planning range: PKR 158,000–250,000 per camp. Use a current approved itemized proposal for the final commitment."><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Sponsorship scope<select aria-label="Sponsorship scope" value={count} onChange={e=>setCount(Number(e.target.value))} className={`${control} mt-2`}>{[[1,'Single camp'],[2,'Dual camp'],[5,'Five camps'],[9,'Half campaign'],[18,'Full 18-camp patron']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-bold">Proposed cost per camp (PKR)<input aria-label="Proposed cost per camp" type="number" min={1} value={budget} onChange={e=>setBudget(Math.max(0,Number(e.target.value)||0))} className={`${control} mt-2`}/></label></div><p className="mt-5 font-serif text-3xl text-[#0B5D3B]">{money(count*budget*100)}</p><p className="mt-3 text-xs leading-relaxed text-[#718675]">{count} camp{count!==1?'s':''} × PKR {budget.toLocaleString('en-PK')}. Enter this amount and matching tier in the contribution form. Capital equipment uses a separate General Fund project and dedication.</p></Card>;
}
