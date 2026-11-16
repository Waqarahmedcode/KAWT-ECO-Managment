import { requireRole,authError } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { sameOrigin } from '@/lib/actor-db';
import { paypalToken } from '@/lib/payments';
import Stripe from 'stripe';
import { z } from 'zod';
import { supabasePublicKey } from '@/lib/supabase-config';

const requirements={
 database:['DATABASE_URL'],supabase:['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],stripe:['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'],paypal:['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID'],meta:['META_APP_SECRET','META_PAGE_ACCESS_TOKEN','META_WEBHOOK_VERIFY_TOKEN','META_GRAPH_VERSION'],whatsapp:['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_RECEIPT_TEMPLATE','META_GRAPH_VERSION'],analytics:['NEXT_PUBLIC_GA4_ID','NEXT_PUBLIC_GTM_ID'],
};
const bindingPresent=(name:string)=>name==='NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'?Boolean(supabasePublicKey()):Boolean(process.env[name]);
export async function GET(){try{await requireRole(['admin']);return Response.json({providers:Object.entries(requirements).map(([provider,names])=>({provider,bindings:names.map(name=>({name:name==='NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'?'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY':name,present:bindingPresent(name)})),remoteVerified:false})),merchantContractsPending:['PayFast','Kuickpay','Meezan'],deliveryPolicy:'Queued messages require explicit worker delivery authorization. Configuration presence does not establish connectivity.'},{headers:{'Cache-Control':'no-store'}})}catch(error){return authError(error)}}
export async function POST(request:Request){try{
 sameOrigin(request);await requireRole(['admin']);const {provider}=z.object({provider:z.enum(['database','supabase','stripe','paypal','meta'])}).parse(await request.json());
 const missing=requirements[provider].filter(name=>!bindingPresent(name));if(missing.length)return Response.json({error:'Missing runtime bindings: '+missing.join(', ')},{status:409});
 if(provider==='database')await getPool().query('select 1');
 else if(provider==='supabase'){
  const supabase=await getSupabase();const session=await supabase.auth.getUser();if(session.error||!session.data.user)throw new Error('Session validation failed');
  const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Invalid API URL');
  const response=await fetch(url.origin+'/auth/v1/health',{headers:{apikey:supabasePublicKey()!},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Health request failed');
 }else if(provider==='stripe')await new Stripe(process.env.STRIPE_SECRET_KEY!).balance.retrieve();
 else if(provider==='paypal')await paypalToken();
 else{
  if(!/^v\d{1,3}\.\d{1,2}$/.test(process.env.META_GRAPH_VERSION!))throw new Error('Invalid API version');
  const response=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/me?fields=id`,{headers:{Authorization:`Bearer ${process.env.META_PAGE_ACCESS_TOKEN}`},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Account lookup failed');
 }
 return Response.json({provider,verified:true,check:'read-only',checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:'Choose a supported read-only connection check'},{status:400});if(error instanceof Error&&['UNAUTHENTICATED','FORBIDDEN'].includes(error.message))return authError(error);return Response.json({error:'The configured service could not be verified. Check credentials, target and network permissions in environment settings.'},{status:502})}}
