import 'server-only';
import { PDFParse } from 'pdf-parse';
import readXlsx from 'read-excel-file/node';
import { createHash } from 'node:crypto';
import { parseLabCsv, parseLabJson, parseLabPerformanceText, parseLabSheets, type ImportedLabDraft, type ImportContext } from './laboratory-import';
import { recognizeLabImage } from './laboratory-ocr';

function safeWorkbook(buffer: Buffer) {
 // Bound declared ZIP expansion before any spreadsheet decompression.
 let end=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65558);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Valid .xlsx workbook darkar hai');
 const entries=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),size=0;
 if(entries>500)throw new Error('Workbook mein bohat zyada internal files hain');
 for(let i=0;i<entries;i++){
  if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50)throw new Error('Workbook ZIP structure invalid hai');
  size+=buffer.readUInt32LE(offset+24);if(size>40*1024*1024)throw new Error('Expanded workbook bohat bara hai');
  offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
 }
}
export async function importLabFile(buffer: Buffer, filename: string, context: ImportContext) {
 if(!buffer.length||buffer.length>8*1024*1024)throw new Error('File 8 MB se chhoti honi chahiye');
 const name=filename.split(/[\\/]/).pop()!.slice(0,180),extension=name.toLowerCase().split('.').pop();
 const warnings:string[]=[],drafts:ImportedLabDraft[]=[],started=Date.now();
 if(buffer.subarray(0,5).toString()==='%PDF-'){
  const parser=new PDFParse({data:buffer,isEvalSupported:false});
  try{
   const info=await parser.getInfo({parsePageInfo:true});
   if(info.total>24)throw new Error('Ek batch mein zyada se zyada 24 PDF pages hon');
   const extracted=await parser.getText();let ocrPages=0;
   for(const page of extracted.pages){
    const source=name+' — page '+page.num;
    if(page.text.trim().length>80){
     try{drafts.push(parseLabPerformanceText(page.text,source,context));}catch(error){warnings.push(source+': '+(error instanceof Error?error.message:'Table mapping nahin hui'));}
    }else{
     if(++ocrPages>2){warnings.push(source+': scanned PDF batch mein pehle do pages OCR huay; baqi alag file mein import karein');continue;}
     if(Date.now()-started>40000){warnings.push(source+': OCR batch waqt ki limit tak pohanch gaya; baqi pages alag import karein');continue;}
     const dimensions=info.pages.find(p=>p.pageNumber===page.num);
     if(dimensions&&(!dimensions.width||dimensions.height/dimensions.width>2.5||dimensions.height/dimensions.width<.3))throw new Error('PDF page dimensions OCR ke liye munasib nahin');
     const shot=await parser.getScreenshot({partial:[page.num],desiredWidth:1800,imageDataUrl:false,imageBuffer:true});
     try{drafts.push(await recognizeLabImage(Buffer.from(shot.pages[0].data),source,context,45000-(Date.now()-started)));}catch(error){warnings.push(source+': '+(error instanceof Error?error.message:'OCR mapping nahin hui'));}
    }
   }
  }finally{await parser.destroy();}
 }else if(extension==='xlsx'&&buffer[0]===0x50&&buffer[1]===0x4b){
  safeWorkbook(buffer);const sheets=await readXlsx(buffer);
  if(sheets.length>36||sheets.reduce((n,s)=>n+s.data.length,0)>12000)throw new Error('Workbook mein bohat zyada sheets/rows hain');
  drafts.push(...parseLabSheets(sheets as {sheet:string;data:unknown[][]}[],name,context));
 }else if(extension==='csv')drafts.push(...parseLabCsv(buffer.toString('utf8').replace(/^\uFEFF/,''),name,context));
 else if(extension==='json')drafts.push(...parseLabJson(buffer.toString('utf8'),name,context));
 else if(buffer.subarray(0,4).equals(Buffer.from([137,80,78,71]))||(buffer[0]===0xff&&buffer[1]===0xd8))drafts.push(await recognizeLabImage(buffer,name,context));
 else if(extension==='xls')throw new Error('Legacy .xls ko .xlsx ya PDF export karke import karein');
 else throw new Error('PDF, .xlsx, CSV, JSON, PNG ya JPEG source file use karein');
 if(!drafts.length)throw new Error(warnings[0]??'Performance count data reliably nahin mila; source ka clear count report use karein');
 return {drafts,warnings,source_sha256:createHash('sha256').update(buffer).digest('hex'),saved:false};
}
