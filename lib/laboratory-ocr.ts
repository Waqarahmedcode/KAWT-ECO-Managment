import 'server-only';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createWorker, PSM } from 'tesseract.js';
import { parseLabPerformanceText, sourcePeriod, type ImportContext, type ImportedLabDraft } from './laboratory-import';
import { labShifts, labTotals, validLabPeriod, type LabPayload, type LabPeriodKind } from './laboratory';
const requireModule = createRequire(join(process.cwd(), 'package.json'));
type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
const topLabels = ['CBC','Blood Group','ESR','PT','APTT','ICTMP','Dengue Combo','NS1','Dengue IGM,IGG','Hbsag ICT','Hcv ICT','H.pyloriAB ICT','T.dot','U.PT','Trop I','CRP','RA','ASOT'];
const lowerLabels = ['Glucouse','Urea','Creatinine','Uric acid','Calcium','Sgpt','Alk.ph','GGT','Bilurbin T/D','LFT','Lipid Profile','Cholestrol','Triglecyrides','Urine DR','Stool DR','HPSA'];
function imageDimensions(buffer: Buffer) {
 if (buffer.length < 24) throw new Error('Readable PNG ya JPEG image darkar hai');
 if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
 if (buffer[0] === 0xff && buffer[1] === 0xd8) {
  for (let offset = 2; offset + 8 < buffer.length;) {
   if (buffer[offset] !== 0xff) { offset++;continue; }
   const marker = buffer[offset+1];
   if (marker === 0xd9 || marker === 0xda) break;
   if (marker === 0xff || marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2;continue; }
   const length = buffer.readUInt16BE(offset+2);if (length < 2 || offset + length + 2 > buffer.length) break;
   if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset+5), width: buffer.readUInt16BE(offset+7) };
   offset += length + 2;
  }
 }
 throw new Error('Readable PNG ya JPEG image darkar hai');
}
async function withWorker<T>(operation: (worker: OcrWorker) => Promise<T>, budgetMs = 45000) {
 await mkdir('/tmp/kawt-lab-ocr', { recursive: true });
 let worker: OcrWorker | undefined, timer: ReturnType<typeof setTimeout> | undefined;
 const ready = createWorker('eng', 1, { langPath: join(process.cwd(), 'public/ocr-data'), gzip: false, cachePath: '/tmp/kawt-lab-ocr', workerPath: requireModule.resolve('tesseract.js/src/worker-script/node/index.js') });
 const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { worker?.terminate().catch(() => {});reject(new Error('OCR waqt ki limit tak pohanch gaya; clearer scan ya structured Excel use karein')); }, Math.max(1000, Math.min(45000, budgetMs))); });
 try { return await Promise.race([ready.then(async value => { worker = value;return operation(value); }), timeout]); }
 finally { if (timer) clearTimeout(timer);if (worker) await worker.terminate().catch(() => {});else void ready.then(value => value.terminate()).catch(() => {}); }
}
export async function recognizeLabImage(buffer: Buffer, source: string, context: ImportContext, budgetMs = 45000): Promise<ImportedLabDraft> {
 const dimensions = imageDimensions(buffer);
 if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 20_000_000) throw new Error('Image ki resolution bohat bari hai; readable smaller scan use karein');
 return withWorker(async worker => {
  if (!context.approvedTemplate) {
   const recognized = await worker.recognize(buffer);
   const draft = parseLabPerformanceText(recognized.data.text, source, context);
   draft.warnings.unshift('OCR confidence ' + recognized.data.confidence.toFixed(0) + '%. Image se counts aur dates manually verify karein.');
   return draft;
  }
  const image = await loadImage(buffer), width = 2400, height = Math.round(image.height / image.width * width);
  if (height < 800 || height > 3600) throw new Error('Approved template ka aligned landscape scan darkar hai');
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');ctx.fillStyle = 'white';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
  const pixels = ctx.getImageData(0,0,width,height).data;
  const dark = (x: number,y: number) => { const i=(y*width+x)*4;return pixels[i]<110&&pixels[i+1]<110&&pixels[i+2]<110; };
  function horizontal(y: number) {
   const runs: [number,number][]=[];let start=-1;
   for(let x=0;x<=width;x++){if(x<width&&dark(x,y)){if(start<0)start=x;}else if(start>=0){if(x-start>12)runs.push([start,x-1]);start=-1;}}
   return runs;
  }
  function cluster(values: number[]) {
   const groups:number[][]=[];for(const v of values){const last=groups[groups.length-1];if(last&&v-last[last.length-1]<=3)last.push(v);else groups.push([v]);}
   return groups.map(g=>Math.round(g.reduce((a,b)=>a+b,0)/g.length));
  }
  const ys=cluster(Array.from({length:height},(_,i)=>i).filter(y=>horizontal(y).some(r=>r[1]-r[0]>width*.35)));
  const blocks:{ys:number[];xs:number[];left:number;right:number}[]=[];
  function verticals(left:number,right:number,top:number,bottom:number){
   const lines:number[]=[];for(let x=left;x<=right;x++){let count=0;for(let y=top;y<=bottom;y++)if(dark(x,y))count++;if(count/(bottom-top+1)>.84)lines.push(x);}
   return cluster(lines);
  }
  for(let i=0;i+4<ys.length;i++){
   const rows=ys.slice(i,i+5),gaps=rows.slice(1).map((v,n)=>v-rows[n]);
   if(Math.min(...gaps)<height*.008||Math.max(...gaps)/Math.min(...gaps)>1.55)continue;
   const run=horizontal(rows[0]).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];if(!run)continue;
   let xs=verticals(run[0],run[1],rows[0],rows[4]);if(xs.length!==20&&xs.length<22)continue;
   // The lower source grid has two intentionally empty test columns plus
   // patient/test summary columns. Its border can continue into Outsource.
   if(xs.length>=22)xs=xs.slice(0,22);
   if(!blocks.some(b=>rows[0]<b.ys[4]&&rows[4]>b.ys[0]))blocks.push({ys:rows,xs,left:xs[0],right:xs[xs.length-1]});
  }
  if(blocks.length!==2)throw new Error('Approved table grid reliably detect nahin hui; clear aligned PDF/scan ya structured Excel use karein');
  const warnings:string[]=['Operator-selected KAWT 34-column template use hui; OCR values aur period review karein.'];
  const header=createCanvas(width,Math.max(1,blocks[0].ys[0]));header.getContext('2d').drawImage(canvas,0,0,width,header.height,0,0,width,header.height);
  const recognized=await worker.recognize(header.toBuffer('image/png'));
  const period=sourcePeriod(recognized.data.text);
  await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789,'});
  let uncertain=0;
  async function number(left:number,right:number,top:number,bottom:number){
   const mx=6,my=5,padding=24,w=Math.max(1,right-left-2*mx),h=Math.max(1,bottom-top-2*my),cell=createCanvas(w*3+padding*2,h*3+padding*2);
   const cellContext=cell.getContext('2d');cellContext.fillStyle='white';cellContext.fillRect(0,0,cell.width,cell.height);cellContext.drawImage(canvas,left+mx,top+my,w,h,padding,padding,w*3,h*3);
   const r=await worker.recognize(cell.toBuffer('image/png')),raw=r.data.text.replace(/\s/g,'').replace(/,/g,'');
   if(!/^\d+$/.test(raw)||r.data.confidence<55||Number(raw)>99_999_999){uncertain++;return null;}
   if(r.data.confidence<85)uncertain++;
   return Number(raw);
  }
  const grids:(number|null)[][][]=[];
  for(const [g,block] of blocks.entries()){const rows:(number|null)[][]=[];for(let r=0;r<4;r++){const cells:(number|null)[]=[];for(let c=1;c<block.xs.length-1;c++)cells.push(g===1&&[13,17].includes(c-1)?null:await number(block.xs[c],block.xs[c+1],block.ys[r],block.ys[r+1]));rows.push(cells);}grids.push(rows);}
  const payload:LabPayload={tests:[],patients:{morning:null,evening:null,night:null},outsource:{patients:null,tests:null},urgent:{morning:{patients:null,tests:null},evening:{patients:null,tests:null},night:{patients:null,tests:null}}};
  const lowerColumns=[0,1,2,3,4,5,6,7,8,9,10,11,12,14,15,16];
  [topLabels,lowerLabels].forEach((labels,g)=>labels.forEach((label,c)=>{
   const column=g===0?c:lowerColumns[c];
   const row={label,morning:grids[g][0][column],evening:grids[g][1][column],night:grids[g][2][column]};
   if(labShifts.every(s=>row[s]!==null)&&grids[g][3][column]!==null&&labShifts.reduce((n,s)=>n+(row[s]??0),0)!==grids[g][3][column])warnings.push(label+': OCR shift total source total se mukhtalif hai.');
   payload.tests.push(row);
  }));
  labShifts.forEach((s,i)=>{payload.patients[s]=grids[1][i][18];});
  const lower=blocks[1],outside=horizontal(lower.ys[0]).filter(r=>r[0]>lower.right+8&&r[1]-r[0]>width*.04).sort((a,b)=>a[0]-b[0]);
  const urgentRun=outside[outside.length-1];
  if(urgentRun){
   const xs=verticals(urgentRun[0],urgentRun[1],lower.ys[0],lower.ys[4]);
   if(xs.length===3)for(let r=0;r<3;r++)payload.urgent[labShifts[r]]={patients:await number(xs[0],xs[1],lower.ys[r],lower.ys[r+1]),tests:await number(xs[1],xs[2],lower.ys[r],lower.ys[r+1])};
   const outsourceXs=verticals(lower.right+8,urgentRun[0]-8,lower.ys[0],lower.ys[4]);
   if(outsourceXs.length===3)payload.outsource={patients:await number(outsourceXs[0],outsourceXs[1],lower.ys[0],lower.ys[4]),tests:await number(outsourceXs[1],outsourceXs[2],lower.ys[0],lower.ys[4])};
  }
  const totals=labTotals(payload),printed=grids[1][3];
  if(printed[18]!==null&&totals.patientTotal!==printed[18])warnings.push('OCR patient total source row se match nahin.');
  if(printed[19]!==null&&totals.testTotal!==printed[19])warnings.push('OCR test total source row se match nahin.');
  if(uncertain)warnings.push(uncertain+' low-confidence/unreadable cells hain. Khaali values null hain; source dekh kar correction karein.');
  if(!period)warnings.push('OCR period reliable nahin mila; date controls se asal period select karein.');
  const fallback=context.kind&&context.start&&context.end&&['day','week','month','half_year','year'].includes(context.kind)&&validLabPeriod(context.kind as LabPeriodKind,context.start,context.end)?context:null;
  return {laboratory_name:context.laboratory_name||'Khidmat-e-Alam Diagnostic Centre',period_kind:period?.period_kind??(fallback?.kind as ImportedLabDraft['period_kind']??null),period_start:period?.period_start??fallback?.start??'',period_end:period?.period_end??fallback?.end??'',source_label:source.slice(0,240),entry_mode:'historical_import',payload,warnings};
 }, budgetMs);
}
