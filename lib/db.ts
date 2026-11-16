import 'server-only';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { supabasePublicKey } from './supabase-config';
const globalPool=globalThis as unknown as {__kawtPool?:Pool};
export function getPool(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL not configured');
 return globalPool.__kawtPool ?? (globalPool.__kawtPool=new Pool({connectionString:process.env.DATABASE_URL,max:5}));
}
export function getDb(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL not configured');
 return drizzle(getPool());
}
export function isConfigured(){return Boolean(process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && supabasePublicKey())}
