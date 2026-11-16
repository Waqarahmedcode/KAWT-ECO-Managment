import { createHmac,timingSafeEqual } from 'node:crypto';
export function documentToken(id:string,secret:string,now=Date.now()){
 const value=Buffer.from(JSON.stringify({id,expires:now+15*60000,purpose:'donation_pdf'})).toString('base64url');
 return value+'.'+createHmac('sha256',secret).update(value).digest('base64url');
}
export function verifyDocumentToken(token:string,id:string,secret:string,now=Date.now()){
 try{const [value,signature,...rest]=token.split('.');if(rest.length||!value||!signature)return false;const expected=createHmac('sha256',secret).update(value).digest('base64url');if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;const data=JSON.parse(Buffer.from(value,'base64url').toString());return data.id===id&&data.purpose==='donation_pdf'&&data.expires>now&&data.expires<=now+15*60000}catch{return false}
}
