import 'server-only';
import { getPool } from './db';

type VerifiedUser={id:string;email?:string;email_confirmed_at?:string};
export async function bootstrapFirstAdministrator(user?:VerifiedUser){
 const email=process.env.KAWT_FIRST_ADMIN_EMAIL?.trim().toLowerCase();
 if(!email)return {status:'not_requested'};
 if(user&&user.email?.trim().toLowerCase()!==email)return {status:'not_target'};
 if(user&&!user.email_confirmed_at)return {status:'verification_required'};
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  await client.query("select pg_advisory_xact_lock(hashtext('kawt-first-administrator'))");
  const closed=(await client.query("select exists(select 1 from public.audit_log where event_name='INITIAL_ADMIN_BOOTSTRAPPED') as closed,exists(select 1 from public.profiles where role='admin') as administrator")).rows[0];
  if(closed.closed||closed.administrator){await client.query('ROLLBACK');return {status:closed.closed?'already_bootstrapped':'administrator_exists'};}
  const target=(await client.query("select u.id,u.email,u.email_confirmed_at,u.confirmation_sent_at,u.raw_user_meta_data->>'full_name' as display_name,exists(select 1 from auth.identities i where i.user_id=u.id and i.provider=any($3::text[]) and i.identity_data->>'email_verified'='true' and lower(i.identity_data->>'email')=lower(u.email)) as trusted_identity from auth.users u where lower(u.email)=$1 and ($2::uuid is null or u.id=$2::uuid)",[email,user?.id??null,['google','apple','azure','github']])).rows;
  if(target.length!==1){await client.query('ROLLBACK');return {status:target.length?'account_ambiguous':'account_required'};}
  const account=target[0];
  // Confirmation timestamps alone can be produced by automatic confirmation.
  // Require evidence of an email challenge or a verified trusted identity.
  const challenged=account.confirmation_sent_at&&account.email_confirmed_at&&new Date(account.email_confirmed_at)>=new Date(account.confirmation_sent_at);
  if(!account.email_confirmed_at||(!challenged&&!account.trusted_identity)){await client.query('ROLLBACK');return {status:'verification_required'};}
  await client.query("insert into public.profiles(id,role,email,display_name) values($1,'admin',$2,$3) on conflict(id) do update set role='admin',email=excluded.email",[account.id,account.email,account.display_name]);
  await client.query("insert into public.audit_log(actor_id,event_name,entity,entity_id,details) values($1::uuid,'INITIAL_ADMIN_BOOTSTRAPPED','profiles',$1::uuid::text,'{\"basis\":\"owner-configured verified account\"}'::jsonb)",[account.id]);
  await client.query('COMMIT');return {status:'administrator_ready',accountsCreated:0};
 }catch(error){await client.query('ROLLBACK');throw error}
 finally{client.release()}
}
