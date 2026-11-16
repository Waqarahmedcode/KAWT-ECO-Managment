import type { AppRole } from './auth';
export type JsonValue=string|number|boolean|null|JsonValue[]|{[key:string]:JsonValue};
export type WorkspaceRow=Record<string,JsonValue>;
export type WorkspaceSnapshot={actor:{id:string;role:AppRole};tables:Record<string,WorkspaceRow[]>;limits:{rowsPerTable:number}};
export const str=(row:WorkspaceRow,key:string)=>String(row[key]??'');
export const num=(row:WorkspaceRow,key:string)=>Number(row[key]??0);
export const money=(paisa:number,currency='PKR')=>new Intl.NumberFormat('en-PK',{style:'currency',currency,maximumFractionDigits:2}).format(paisa/100);
