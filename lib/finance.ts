export const currencies=['PKR','USD','GBP','CAD','AED','EUR'] as const;
export function validPakistaniIban(input:string){
 const iban=input.replace(/\s/g,'').toUpperCase();
 if(!/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban))return false;
 const digits=(iban.slice(4)+iban.slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));
 let remainder=0;for(const digit of digits)remainder=(remainder*10+Number(digit))%97;
 return remainder===1;
}
export function zakatEstimate(input:{cash:number;gold:number;silver:number;business:number;receivables:number;liabilities:number;nisab:number;heldLunarYear:boolean}){
 const values=[input.cash,input.gold,input.silver,input.business,input.receivables,input.liabilities,input.nisab];
 if(values.some(v=>!Number.isFinite(v)||v<0))throw new Error('Amounts must be finite and nonnegative');
 const net=Math.max(0,input.cash+input.gold+input.silver+input.business+input.receivables-input.liabilities);
 const eligible=input.heldLunarYear&&input.nisab>0&&net>=input.nisab;
 return {net,eligible,amount:eligible?Math.round(net*2.5)/100:0};
}
