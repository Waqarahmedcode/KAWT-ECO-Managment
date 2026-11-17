import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rootCertificates } from 'node:tls';
import type { ClientConfig } from 'pg';

export function databaseConnectionOptions(connectionString: string): ClientConfig {
 const target = new URL(connectionString);
 if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw Object.assign(new Error(), {code:'INVALID_DATABASE_URL'});
 const local = ['localhost','127.0.0.1','[::1]'].includes(target.hostname);
 for (const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert']) target.searchParams.delete(key);
 const supabase = target.hostname.endsWith('.supabase.com') || target.hostname.endsWith('.supabase.co');
 const ssl = local ? false : {rejectUnauthorized:true,...(supabase?{ca:[...rootCertificates,readFileSync(resolve(process.cwd(),'data/certs/supabase-prod-ca-2021.crt'),'utf8')]}:{})};
 return {connectionString:target.toString(),ssl,connectionTimeoutMillis:15000,query_timeout:15000};
}
