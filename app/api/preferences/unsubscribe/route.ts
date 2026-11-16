import { z } from 'zod';
import { getPool } from '@/lib/db';
import { sameOrigin } from '@/lib/actor-db';
import { readUnsubscribeToken } from '@/server/communications';
export async function POST(request:Request){try{
 sameOrigin(request);const {token}=z.object({token:z.string().max(2000)}).parse(await request.json());
 const secret=process.env.APP_UNSUBSCRIBE_SECRET;if(!secret)return Response.json({error:'Preference service is not configured'},{status:503});
 const donor=readUnsubscribeToken(token,secret);if(!donor)return Response.json({error:'This preference link is invalid or expired'},{status:400});
 await getPool().query('update public.donors set marketing_consent=false where id=$1',[donor]);
 return Response.json({unsubscribed:true});
}catch{return Response.json({error:'Unable to update preferences'},{status:400})}}
