'use client';
import { useEffect,useSyncExternalStore } from 'react';

declare global{interface Window{dataLayer?:unknown[];gtag?:(...args:unknown[])=>void}}
const consentKey='kawt-public-analytics-consent';
const subscribe=(callback:()=>void)=>{window.addEventListener('storage',callback);window.addEventListener('kawt-consent',callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener('kawt-consent',callback)}};
const snapshot=()=>localStorage.getItem(consentKey);
export function givingEvent(name:'donation_intent'|'donation_completed'|'calculator_completed'|'checkout_started'|'checkout_cancelled',values:{currency?:string;value?:number;fund?:string;method:string;transaction_id?:string}){
 if(window.location.pathname!=='/donate'||localStorage.getItem(consentKey)!=='accepted')return;
 // Allowlisted fields only: no donor names, contacts, patient data or URL tokens.
 window.dataLayer??=[];window.dataLayer.push({event:name,...values});
 window.gtag?.('event',name,values);
}
export function GivingAnalytics({ga4,gtm}:{ga4?:string;gtm?:string}){
 const consent=useSyncExternalStore(subscribe,snapshot,()=>null);
 const measurement=ga4&&/^G-[A-Z0-9]{4,20}$/.test(ga4)?ga4:null;
 const container=gtm&&/^GTM-[A-Z0-9]{4,20}$/.test(gtm)?gtm:null;
 useEffect(()=>{
  if(consent!=='accepted')return;
  const query=new URLSearchParams(window.location.search);if(['token','request','reference'].some(key=>query.has(key)))return;
  window.dataLayer??=[];
  const scripts:HTMLScriptElement[]=[];
  if(measurement){
   window.gtag=(...args:unknown[])=>{window.dataLayer!.push(args)};
   window.gtag('js',new Date());window.gtag('config',measurement,{send_page_view:false,page_location:window.location.origin+'/donate'});
   window.gtag('event','page_view',{page_location:window.location.origin+'/donate',page_title:'KAWT giving portal'});
   const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+measurement;document.head.append(script);scripts.push(script);
  }
  if(container){window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtm.js?id='+container;document.head.append(script);scripts.push(script)}
  return()=>scripts.forEach(script=>script.remove());
 },[consent,measurement,container]);
 if(!measurement&&!container)return null;
 const choose=(value:string)=>{localStorage.setItem(consentKey,value);window.dispatchEvent(new Event('kawt-consent'));if(value==='declined')window.location.reload()};
 return <aside className="no-print fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-xl border border-emerald-200 bg-white p-4 shadow-xl"><p className="text-sm text-[#315440]">{consent==='accepted'?'Giving-page analytics are enabled.':'Optional giving-page analytics help measure fundraising. Your choice does not affect giving.'}</p><div className="mt-3 flex gap-4 text-sm">{consent!=='accepted'&&<button className="font-bold text-[#0B5D3B] underline" onClick={()=>choose('accepted')}>Allow analytics</button>}<button className="text-[#526b5b] underline" onClick={()=>choose('declined')}>{consent==='accepted'?'Turn analytics off':consent==='declined'?'Analytics off':'Continue without analytics'}</button></div></aside>;
}
