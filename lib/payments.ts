import 'server-only';
import Stripe from 'stripe';

export function siteUrl(){
 const url=new URL(process.env.NEXT_PUBLIC_SITE_URL??'http://127.0.0.1:3001');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS except for loopback development');
 return url.origin;
}
export function paypalBase(){return process.env.PAYPAL_MODE==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'}
export async function paypalToken(){
 const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
 if(!id||!secret)throw new Error('PayPal credentials are not configured');
 const response=await fetch(paypalBase()+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('PayPal authentication failed');
 return String((await response.json()).access_token);
}
export async function createCheckout(input:{id:string;amount:number;currency:string;fund:string;email:string;provider:'stripe'|'paypal';requestId:string}){
 const origin=siteUrl();
 if(input.provider==='stripe'){
  const secret=process.env.STRIPE_SECRET_KEY;if(!secret)throw new Error('Stripe is not configured');
  const session=await new Stripe(secret).checkout.sessions.create({mode:'payment',customer_email:input.email,client_reference_id:input.id,metadata:{donation_id:input.id},line_items:[{quantity:1,price_data:{currency:input.currency.toLowerCase(),unit_amount:input.amount,product_data:{name:`KAWT ${input.fund==='ZAKAT'?'Zakat':'General donation'}`}}}],success_url:`${origin}/donate?status=processing&reference=${input.requestId}`,cancel_url:`${origin}/donate?status=cancelled`},{idempotencyKey:'kawt-donation-'+input.id});
  if(!session.url)throw new Error('Stripe returned no checkout URL');
  return {id:session.id,url:session.url};
 }
 if(!['USD','GBP','CAD','EUR','AUD'].includes(input.currency))throw new Error('PayPal does not support this selected currency; choose another payment method');
 const token=await paypalToken();
 const response=await fetch(paypalBase()+'/v2/checkout/orders',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':input.id},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{custom_id:input.id,amount:{currency_code:input.currency,value:(input.amount/100).toFixed(2)}}],application_context:{brand_name:'Khidmat-e-Alam Welfare Trust',return_url:`${origin}/donate?status=paypal_approved&request=${input.id}`,cancel_url:`${origin}/donate?status=cancelled`,user_action:'PAY_NOW'}}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('PayPal rejected checkout creation');
 const order=await response.json() as {id:string;links:{rel:string;href:string}[]};
 const link=order.links.find(link=>link.rel==='approve');if(!link)throw new Error('PayPal returned no approval URL');
 return {id:order.id,url:link.href};
}
