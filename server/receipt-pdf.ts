import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
type Receipt={id:string;full_name:string|null;fund:string;currency:string;amount_minor_units:number|string;refunded_minor_units:number|string;confirmed_at:string|Date;status:string;provider:string};
type Certificate={id:string;authorized_name:string;authorized_title:string;issued_at:string|Date;document_references:unknown;statement:string};
export async function receiptPdf(record:Receipt,certificate?:Certificate){
 const pdf=await PDFDocument.create();pdf.setTitle(certificate?'KAWT contribution tax certificate':'KAWT donation acknowledgement');pdf.setCreator('Khidmat-e-Alam Welfare Trust');
 const page=pdf.addPage([595.28,841.89]);const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);const green=rgb(.043,.365,.231);
 // Standard PDF fonts support Latin text. Preserve the original Unicode name in
 // the database; never let an unsupported glyph crash receipt delivery.
 const safe=(value:unknown)=>String(value??'').replace(/[^\x20-\x7e]/g,'?');
 const text=(value:unknown,x:number,y:number,size=11,emphasized=false)=>page.drawText(safe(value),{x,y,size,font:emphasized?bold:regular,color:green,maxWidth:475,lineHeight:17});
 const logo=await pdf.embedPng(await readFile(join(process.cwd(),'public/brand/kawt-logo.png')));page.drawImage(logo,{x:50,y:720,width:70,height:70});
 page.drawRectangle({x:0,y:821,width:595.28,height:20,color:green});text('KHIDMAT-E-ALAM WELFARE TRUST',50,690,18,true);
 text(certificate?'CONTRIBUTION TAX CERTIFICATE':'DONATION ACKNOWLEDGEMENT',50,655,16,true);
 const details=[['Contribution reference',record.id],['Donor',record.full_name??'Supporter'],['Fund',record.fund],['Confirmed amount',`${record.currency} ${(Number(record.amount_minor_units)/100).toFixed(2)}`],['Refunded amount',`${record.currency} ${(Number(record.refunded_minor_units)/100).toFixed(2)}`],['Received on',new Date(record.confirmed_at).toISOString().slice(0,10)],['Payment channel',record.provider],['Status',record.status]];
 let y=610;for(const [label,value]of details){text(label,50,y,10,true);text(value,220,y,10);y-=34}
 if(certificate){text('Certificate reference: '+certificate.id,50,y-10,10);text('Authorized by: '+certificate.authorized_name,50,y-40,11,true);text(certificate.authorized_title,50,y-60,10);text('Issued: '+new Date(certificate.issued_at).toISOString().slice(0,10),50,y-80,10);text(certificate.statement,50,y-110,10);text('Eligibility/deductibility remain subject to applicable law and donor status.',50,140,9)}
 else{text('This acknowledges a verified contribution. A tax certificate is issued',50,y-25,10);text('separately by authorized finance staff under current eligibility.',50,y-42,10)}
 text('Thank you for supporting community care.',50,85,12,true);text('Private financial document. Verify references with KAWT finance.',50,60,9);
 return pdf.save();
}
