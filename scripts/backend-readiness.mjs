import { Client } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';

// Dedicated build credential; deliberately independent of runtime DATABASE_URL.
const connectionString = process.env.KAWT_READINESS_DATABASE_URL;
const emit = (value) => console.log('KAWT_BACKEND_READINESS ' + JSON.stringify(value));
if (!connectionString) {
  emit({ status: 'not_configured', databaseChanged: false });
  process.exit(process.env.KAWT_READINESS_STRICT === '1' ? 1 : 0);
}
const migrations = new URL('../supabase/migrations/', import.meta.url);
const files = readdirSync(migrations).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
const versions = files.map(name => name.split('_')[0]);
const tables = [...new Set(files.flatMap(name => [...readFileSync(new URL(name, migrations), 'utf8').matchAll(/create\s+table\s+public\.(\w+)/gi)].map(match => match[1])))].sort();
let client;
try {
  const target = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw Object.assign(new Error(), { code: 'INVALID_DATABASE_URL' });
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  // pg URL SSL options override explicit SSL settings; enforce verified remote TLS.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) target.searchParams.delete(key);
  const supabase = target.hostname.endsWith('.supabase.com') || target.hostname.endsWith('.supabase.co');
  const ssl = local ? false : { rejectUnauthorized: true, ...(supabase ? { ca: [...rootCertificates, readFileSync(new URL('../data/certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8')] } : {}) };
  client = new Client({ connectionString: target.toString(), ssl, connectionTimeoutMillis: 15000, query_timeout: 15000 });
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '10s'");
  const readOnly = (await client.query("select current_setting('transaction_read_only') as value")).rows[0].value === 'on';
  if (!readOnly) throw Object.assign(new Error(), { code: 'READ_ONLY_REQUIRED' });
  const found = (await client.query("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname=any($1::text[])", [tables])).rows;
  const present = new Set(found.map(row => row.relname));
  const missingTables = tables.filter(name => !present.has(name));
  const tablesWithoutRls = found.filter(row => !row.relrowsecurity).map(row => row.relname).sort();
  const historyPresent = Boolean((await client.query("select to_regclass('supabase_migrations.schema_migrations') as history")).rows[0].history);
  const applied = historyPresent ? (await client.query('select version from supabase_migrations.schema_migrations where version=any($1::text[])', [versions])).rows.map(row => row.version) : [];
  const missingMigrations = versions.filter(version => !applied.includes(version));
  const storagePresent = Boolean((await client.query("select to_regclass('storage.buckets') as buckets")).rows[0].buckets);
  const bucket = storagePresent ? (await client.query('select public from storage.buckets where id=$1', ['private-camp-receipts'])).rows[0] : undefined;
  const privateReceiptBucket = bucket?.public === false;
  await client.query('ROLLBACK');
  const ready = !missingTables.length && !tablesWithoutRls.length && !missingMigrations.length && privateReceiptBucket;
  emit({ status: ready ? 'schema_ready' : 'schema_incomplete', connected: true, readOnly, missingTables, tablesWithoutRls, missingMigrations, privateReceiptBucket, databaseChanged: false });
  if (!ready && process.env.KAWT_READINESS_STRICT === '1') process.exitCode = 1;
} catch (error) {
  const rawCode = String(error?.code || 'CONNECTION_FAILED');
  const code = /^[A-Z0-9_]{1,60}$/.test(rawCode) ? rawCode : 'CONNECTION_FAILED';
  // Never log an exception message, URI, credentials, or business records.
  emit({ status: 'connection_failed', code, databaseChanged: false });
  if (process.env.KAWT_READINESS_STRICT === '1') process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
