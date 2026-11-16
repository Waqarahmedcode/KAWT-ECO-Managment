import { num,str,type WorkspaceRow } from './workspace-types';

export function medicineForecast({patients,inventory,dispensations,medicines,targetPatients}:{patients:WorkspaceRow[];inventory:WorkspaceRow[];dispensations:WorkspaceRow[];medicines:WorkspaceRow[];targetPatients:number}){
 if(!Number.isInteger(targetPatients)||targetPatients<1)throw new Error('Enter a positive target patient count');
 const served=new Set(dispensations.map(d=>str(d,'patient_id')));
 const validPatients=patients.filter(p=>served.has(str(p,'id')));
 if(validPatients.length<10)return {method:'Observed dispensing rate × planned attendees',sample:validPatients.length,forecasts:[],limitation:'At least 10 patient-linked dispensing records are required. Historical purchase quantities are excluded.'};
 const validIds=new Set(validPatients.map(p=>str(p,'id')));
 const batches=new Map(inventory.map(i=>[str(i,'id'),i]));
 const quantities=new Map<string,number>();
 for(const line of dispensations){if(!validIds.has(str(line,'patient_id')))continue;const batch=batches.get(str(line,'inventory_id'));if(batch){const key=str(batch,'medicine_id');quantities.set(key,(quantities.get(key)??0)+num(line,'units'))}}
 const forecasts=[...quantities.entries()].map(([id,units])=>({medicine:medicines.find(m=>m.id===id)?.generic_name??id,observedUnits:units,unitsPerPatient:units/validPatients.length,recommendedUnits:Math.ceil(units/validPatients.length*targetPatients),stockUnit:medicines.find(m=>m.id===id)?.stock_unit??'units'}));
 return {method:'Observed dispensing rate × planned attendees',sample:validPatients.length,forecasts,limitation:'A transparent demand estimate, not a trained clinical model. Review case mix, season, lead times, stock on hand and formulation before procurement.'};
}

export function donorRetention(donors:WorkspaceRow[],donations:WorkspaceRow[],now=new Date()){
 return donors.filter(d=>d.marketing_consent===true).map(d=>{
  const paid=donations.filter(n=>n.donor_id===d.id&&n.status==='confirmed');
  const last=Math.max(...paid.map(n=>Date.parse(str(n,'created_at'))).filter(Number.isFinite));
  const days=Number.isFinite(last)?Math.max(0,Math.floor((now.getTime()-last)/86400000)):null;
  return {donor:str(d,'full_name')||'Supporter',id:str(d,'id'),confirmedDonations:paid.length,daysSinceLastDonation:days,review:days==null?'No donation history':days>=180?'Re-engagement review':days>=90?'Follow-up review':'Recently active'};
 });
}

export function campaignPerformance(campaigns:WorkspaceRow[],donations:WorkspaceRow[]){
 return campaigns.map(c=>{
  const attributed=donations.filter(d=>d.campaign_id===c.id&&d.status==='confirmed');
  const pkr=attributed.filter(d=>d.currency==='PKR').reduce((sum,d)=>sum+num(d,'amount_minor_units'),0);
  const spend=num(c,'spend_paisa');
  return {campaign:str(c,'title'),confirmedDonations:attributed.length,pkrMinor:pkr,spendMinor:spend,returnOnSpend:spend>0?pkr/spend:null,foreignCurrencyCount:attributed.filter(d=>d.currency!=='PKR').length};
 });
}

export function sponsorMatches(partners:WorkspaceRow[],projects:WorkspaceRow[]){
 return partners.filter(p=>p.consent_to_contact===true).flatMap(partner=>{
  const interests=Array.isArray(partner.interests)?partner.interests.map(String).map(x=>x.toLowerCase()):[];
  return projects.map(project=>{
   const description=(str(project,'title')+' '+str(project,'description')).toLowerCase();
   const matched=interests.filter(interest=>description.includes(interest));
   return {partner:str(partner,'organization'),project:str(project,'title'),matchedInterests:matched,score:matched.length};
  }).filter(match=>match.score>0);
 }).sort((a,b)=>b.score-a.score);
}
