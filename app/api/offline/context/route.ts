import { actorTransaction,workspaceError } from '@/lib/actor-db';
export async function GET(){try{
 const data=await actorTransaction(['admin','camp_manager','doctor'],async(db,actor)=>({userId:actor.id,camps:(await db.query("select id,title from public.camps where status in ('approved','in_progress') order by id")).rows}));
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}catch(error){return workspaceError(error)}}
