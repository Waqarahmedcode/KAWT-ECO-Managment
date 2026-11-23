import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
// Supabase CLI must see the core and module history together on repeat runs.
// Build an ignored CLI workdir; the original SQL/config files remain unchanged.
export function prepareLocalMigrations(root=process.cwd()) {
 const workdir=resolve(root,'.local','migration-workdir');
 const directory=join(workdir,'supabase','migrations');
 rmSync(directory,{recursive:true,force:true});mkdirSync(directory,{recursive:true});
 copyFileSync(join(root,'supabase','config.toml'),join(workdir,'supabase','config.toml'));
 for(const source of ['migrations','lab-migrations'])for(const file of readdirSync(join(root,'supabase',source)).filter(name=>/^\d+_.+\.sql$/.test(name)))copyFileSync(join(root,'supabase',source,file),join(directory,file));
 return workdir;
}
