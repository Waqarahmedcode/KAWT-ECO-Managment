import { createHmac,timingSafeEqual } from 'node:crypto';
export class DeliveryError extends Error{
 constructor(message:string,public code:string,public uncertain=false,public retryAfter?:number){super(message)}
}
export function unsubscribeToken(donorId:string,secret:string,now=Date.now()){
 const data=Buffer.from(JSON.stringify({donorId,expires:now+366*86400000})).toString('base64url');
 return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');
}
export function readUnsubscribeToken(token:string,secret:string,now=Date.now()):string|null{
 try{
  const [data,signature,...extra]=token.split('.');if(extra.length||!data||!signature)return null;
  const expected=createHmac('sha256',secret).update(data).digest('base64url');
  if(expected.length!==signature.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))return null;
  const value=JSON.parse(Buffer.from(data,'base64url').toString()) as {donorId?:string;expires?:number};
  return typeof value.donorId==='string'&&/^[a-f0-9-]{36}$/.test(value.donorId)&&Number(value.expires)>now?value.donorId:null;
 }catch{return null}
}
export async function sendWhatsApp(input:{token:string;phoneId:string;version:string;template:string;language:string;to:string;parameters:string[];document?:{url:string;filename:string}},transport:typeof fetch=fetch){
 if(!/^v\d{1,3}\.\d{1,2}$/.test(input.version)||!/^\d{5,30}$/.test(input.phoneId))throw new DeliveryError('Configure an approved Graph API version and WhatsApp phone-number ID','configuration');
 if(!/^\+[1-9]\d{6,14}$/.test(input.to))throw new DeliveryError('Recipient must use international phone format','recipient');
 if(input.document&&new URL(input.document.url).protocol!=='https:')throw new DeliveryError('Document links must use HTTPS','configuration');
 let response:Response;
 try{
  response=await transport(`https://graph.facebook.com/${input.version}/${input.phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${input.token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:input.to,type:'template',template:{name:input.template,language:{code:input.language},components:[...(input.document?[{type:'header',parameters:[{type:'document',document:{link:input.document.url,filename:input.document.filename}}]}]:[]),{type:'body',parameters:input.parameters.map(text=>({type:'text',text}))}]}}),signal:AbortSignal.timeout(20000)});
 }catch{throw new DeliveryError('Transport failed after submission; check provider records before retrying','transport',true)}
 if(response.status===429)throw new DeliveryError('Provider rate limit; retry after the specified interval','429',false,Math.max(1,Math.min(3600,Number(response.headers.get('retry-after'))||60)));
 if(!response.ok)throw new DeliveryError(`Provider rejected the request (HTTP ${response.status})`,String(response.status),response.status>=500);
 try{
  const body=await response.json() as {messages?:{id?:string}[]};const id=body.messages?.[0]?.id;
  if(!id)throw new Error('Missing provider message reference');return id;
 }catch{throw new DeliveryError('Provider response could not be reconciled; do not resend blindly','response',true)}
}
