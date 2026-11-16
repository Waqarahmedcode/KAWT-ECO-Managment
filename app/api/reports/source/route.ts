import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireRole,authError } from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 await requireRole(['admin','camp_manager','doctor','pharmacist']);
 const camp=new URL(request.url).searchParams.get('camp')??'ALL';
 if(camp!=='ALL'&&!/^FMC-0[1-6]$/.test(camp))return new Response('No original source report exists for this camp',{status:404});
 const source=(await readFile(join(process.cwd(),'data/source-report.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 let html=source;
 if(camp!=='ALL'){
  const prefix=source.split('<div class="rpg">')[0];
  const pages=source.split('<div class="rpg">').slice(1).map(page=>page.replace(/<\/body>\s*<\/html>\s*$/i,''));
  const index=(Number(camp.slice(-2))-1)*2+1;
  html=prefix+'<div class="rpg">'+pages[index]+'<div class="rpg">'+pages[index+1]+'</body></html>';
 }
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-same-origin allow-modals",'X-Content-Type-Options':'nosniff'}});
}catch(error){return authError(error)}}
