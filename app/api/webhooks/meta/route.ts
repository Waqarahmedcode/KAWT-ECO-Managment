import { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';
import { validMetaSignature,applyMetaEvent } from '@/server/meta-events';
export const runtime='nodejs';
export async function GET(request:NextRequest){const query=request.nextUrl.searchParams,token=process.env.META_WEBHOOK_VERIFY_TOKEN;
 if(query.get('hub.mode')==='subscribe'&&token&&query.get('hub.verify_token')===token)return new Response(query.get('hub.challenge')??'',{headers:{'Content-Type':'text/plain'}});
 return new Response('Forbidden',{status:403});
}
export async function POST(request:NextRequest){
 const secret=process.env.META_APP_SECRET;if(!secret)return new Response('Meta application secret is not configured',{status:503});
 const raw=await request.text();if(raw.length>1048576)return new Response('Payload too large',{status:413});
 if(!validMetaSignature(raw,request.headers.get('x-hub-signature-256')??'',secret))return new Response('Invalid signature',{status:401});
 let payload:unknown;try{payload=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
 const client=await getPool().connect();
 try{await client.query('BEGIN');await applyMetaEvent(client,payload,raw);await client.query('COMMIT');return Response.json({received:true})}
 catch{await client.query('ROLLBACK');return Response.json({error:'Verified event could not be processed; safe to retry'},{status:409})}
 finally{client.release()}
}
