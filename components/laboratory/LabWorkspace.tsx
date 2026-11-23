'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import catalogue from '@/data/laboratory-catalogue.json';
import { csvValue, labPayloadSchema, labReportSchema, labShifts, labTotals, mainLaboratoryName, type LabPayload, type LabReport, type LabReportInput, type LabShift } from '@/lib/laboratory';
import type { ImportedLabDraft } from '@/lib/laboratory-import';

type DraftRow = { label: string; morning: string; evening: string; night: string };
type ReportSummary = Pick<LabReport, 'id' | 'period_kind' | 'period_start' | 'period_end' | 'source_label' | 'revision' | 'laboratory_name'>;
const labels = { morning: 'Morning', evening: 'Evening', night: 'Night' };
const inputClass = 'w-full rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-sm';
const buttonClass = 'rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-40';
function count(value: string): number | null {
 if (!value.trim()) return null;
 if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 99_999_999) throw new Error('Count 0 ya us se bara poora number hona chahiye');
 return Number(value);
}
const blankShifts = () => ({ morning: '', evening: '', night: '' });
const blankUrgent = () => ({ morning: { patients: '', tests: '' }, evening: { patients: '', tests: '' }, night: { patients: '', tests: '' } });
function download(name: string, text: string, type: string) {
 const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');a.href = url;a.download = name;a.click();setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fingerprint(value: LabReportInput) {
 return JSON.stringify([value.laboratory_name, value.period_kind, value.period_start, value.period_end, value.source_label, value.entry_mode, labPayloadSchema.parse({ ...value.payload, notes: value.payload.notes ?? '' })]);
}
export default function LabWorkspace({ access, laboratoryName }: { access: 'admin' | 'operator' | 'viewer'; laboratoryName: string }) {
 const router = useRouter();
 const [labName, setLabName] = useState(laboratoryName || mainLaboratoryName);
 const [reports, setReports] = useState<ReportSummary[]>([]), [id, setId] = useState<string>(), [revision, setRevision] = useState<number>();
 const [kind, setKind] = useState<LabReportInput['period_kind']>('day'), [start, setStart] = useState(''), [end, setEnd] = useState(''), [source, setSource] = useState(''), [mode, setMode] = useState<LabReportInput['entry_mode']>('manual');
 const [rows, setRows] = useState<DraftRow[]>([]), [patients, setPatients] = useState(blankShifts), [outsource, setOutsource] = useState({ patients: '', tests: '' }), [urgent, setUrgent] = useState(blankUrgent);
 const [search, setSearch] = useState(''), [sort, setSort] = useState('desc'), [shift, setShift] = useState<'total' | LabShift>('total'), [notes, setNotes] = useState(''), [history, setHistory] = useState<{ action: string; changed_at: string; revision: string }[]>([]);
 const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [staffEmail, setStaffEmail] = useState('');
 const [savedFingerprint, setSavedFingerprint] = useState('');
 const [candidates,setCandidates]=useState<ImportedLabDraft[]>([]),[candidateIndex,setCandidateIndex]=useState(0),[importWarnings,setImportWarnings]=useState<string[]>([]),[approvedTemplate,setApprovedTemplate]=useState(false);
 const canWrite = access !== 'viewer';
 const loadList = useCallback(async () => {
  const response = await fetch('/api/lab/reports', { cache: 'no-store' });const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Reports load nahin huin');setReports(result.reports);
 }, []);
 useEffect(() => {
  let active = true;
  fetch('/api/lab/reports', { cache: 'no-store' }).then(async response => {
   const result = await response.json();if (!response.ok) throw new Error(result.error ?? 'Reports load nahin huin');return result;
  }).then(result => { if (active) setReports(result.reports); }).catch(error => { if (active) setMessage(error.message); });
  return () => { active = false; };
 }, []);
 function payload(): LabPayload {
  return { tests: rows.map(row => ({ label: row.label, morning: count(row.morning), evening: count(row.evening), night: count(row.night) })), patients: { morning: count(patients.morning), evening: count(patients.evening), night: count(patients.night) }, outsource: { patients: count(outsource.patients), tests: count(outsource.tests) }, urgent: Object.fromEntries(labShifts.map(s => [s, { patients: count(urgent[s].patients), tests: count(urgent[s].tests) }])) as LabPayload['urgent'], notes };
 }
 let stats: ReturnType<typeof labTotals> | null = null;
 try { if (rows.length) stats = labTotals(payload()); } catch { /* invalid draft values remain visible for correction */ }
 const visible = useMemo(() => rows.map((r, index) => ({ ...r, index })).filter(r => r.label.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
  const metric = (r: DraftRow) => shift === 'total' ? labShifts.reduce((n, s) => n + (Number(r[s]) || 0), 0) : Number(r[shift]) || 0;
  return sort === 'name' ? a.label.localeCompare(b.label) : (sort === 'asc' ? metric(a) - metric(b) : metric(b) - metric(a)) || a.label.localeCompare(b.label);
 }), [rows, search, sort, shift]);
 function populate(value: LabReportInput) {
  setSavedFingerprint(value.id ? fingerprint(value) : '');setLabName(value.laboratory_name);
  setId(value.id);setRevision(value.revision);setKind(value.period_kind);setStart(value.period_start);setEnd(value.period_end);setSource(value.source_label);setMode(value.entry_mode);setNotes(value.payload.notes ?? '');
  const text = (n: number | null) => n === null ? '' : String(n);
  setRows(value.payload.tests.map(t => ({ label: t.label, morning: text(t.morning), evening: text(t.evening), night: text(t.night) })));
  setPatients(Object.fromEntries(labShifts.map(s => [s, text(value.payload.patients[s])])) as ReturnType<typeof blankShifts>);
  setOutsource({ patients: text(value.payload.outsource.patients), tests: text(value.payload.outsource.tests) });
  setUrgent(Object.fromEntries(labShifts.map(s => [s, { patients: text(value.payload.urgent[s].patients), tests: text(value.payload.urgent[s].tests) }])) as ReturnType<typeof blankUrgent>);
 }
 let savedMatches = false;
 try { savedMatches = Boolean(id && savedFingerprint === fingerprint({ laboratory_name: labName, period_kind: kind, period_start: start, period_end: end, source_label: source, entry_mode: mode, payload: payload() })); } catch { /* incomplete draft cannot be exported as the saved workbook */ }
 async function openReport(reportId: string) {
  if (!reportId) return;
  setBusy(true);setMessage('');
  try { const response = await fetch('/api/lab/reports?id=' + encodeURIComponent(reportId), { cache: 'no-store' });const result = await response.json();if (!response.ok) throw new Error(result.error);populate(result.report);setHistory(result.history);setMessage('Saved report load ho gayi. Correction ke baad Save karein.'); }
  catch (error) { setMessage(error instanceof Error ? error.message : 'Report load nahin hui'); } finally { setBusy(false); }
 }
 async function save() {
  setBusy(true);setMessage('');
  try {
   const value = labReportSchema.parse({ laboratory_name: labName, id, revision, period_kind: kind, period_start: start, period_end: end, source_label: source, entry_mode: mode, payload: payload() });
   const response = await fetch('/api/lab/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });const result = await response.json();
   if (!response.ok) throw new Error(result.error);populate(result.report);
   if(candidates.length){setCandidates(candidates.filter((_,i)=>i!==candidateIndex));setCandidateIndex(0);}
   await loadList();setMessage('Report save ho gayi. Totals aur correction history update hain.');
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Save nahin hua'); } finally { setBusy(false); }
 }
 function newReport() { setCandidates([]);setImportWarnings([]);setId(undefined);setRevision(undefined);setKind('day');setStart('');setEnd('');setSource('');setMode('manual');setRows([]);setPatients(blankShifts());setOutsource({ patients: '', tests: '' });setUrgent(blankUrgent());setNotes('');setHistory([]);setMessage('Nayi entry: asal date aur shift counts darj karein. Khaali count ka matlab not reported hai.'); }
 async function importFile(file: File) {
  setBusy(true);setImportWarnings([]);
  try {
   if (file.size > 8*1024*1024) throw new Error('Source file 8 MB se chhoti honi chahiye');
   const form=new FormData();form.set('file',file);form.set('laboratory_name',labName);form.set('kind',kind);form.set('start',start);form.set('end',end);form.set('approvedTemplate',String(approvedTemplate));
   const response=await fetch('/api/lab/import',{method:'POST',body:form}),result=await response.json();
   if(!response.ok)throw new Error(result.error);
   setCandidates(result.drafts);setCandidateIndex(0);setImportWarnings(result.warnings??[]);showCandidate(result.drafts[0]);
   setMessage('Source se '+result.drafts.length+' report drafts load huay. Dates/counts review karke Save karein; abhi database mein save nahin huay.');
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Source file read nahin hui'); }
  finally{setBusy(false);}
 }
 function showCandidate(draft:ImportedLabDraft){
  populate({laboratory_name:draft.laboratory_name,period_kind:draft.period_kind??'day',period_start:draft.period_start,period_end:draft.period_end,source_label:draft.source_label,entry_mode:'historical_import',payload:draft.payload});setHistory([]);
 }
 async function saveCandidates(){
  setBusy(true);
  try{
   const reports=candidates.map((candidate,i)=>labReportSchema.parse(i===candidateIndex?{laboratory_name:labName,period_kind:kind,period_start:start,period_end:end,source_label:source,entry_mode:'historical_import',payload:payload()}:{laboratory_name:candidate.laboratory_name,period_kind:candidate.period_kind,period_start:candidate.period_start,period_end:candidate.period_end,source_label:candidate.source_label,entry_mode:'historical_import',payload:candidate.payload}));
   const response=await fetch('/api/lab/reports/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reports)}),result=await response.json();
   if(!response.ok)throw new Error(result.error);setCandidates([]);await loadList();if(result.reports?.[0]?.id)await openReport(result.reports[0].id);setMessage(result.saved+' source reports ek transaction mein save huin. Duplicate periods dobara add nahin huay.');
  }catch(error){setMessage(error instanceof Error?error.message:'Source batch save nahin hua');}finally{setBusy(false);}
 }
 function exportReport(format: 'json' | 'csv') {
  try {
   const value = labReportSchema.parse({ laboratory_name: labName, id, revision, period_kind: kind, period_start: start, period_end: end, source_label: source, entry_mode: mode, payload: payload() });
   if (format === 'json') { download('KAWT-lab-' + start + '.json', JSON.stringify(value, null, 2), 'application/json');return; }
   const table: (string | number)[][] = [['Laboratory', 'Period kind', 'Period start', 'Period end', 'Test', 'Morning', 'Evening', 'Night', 'Reported total']];
   for (const t of value.payload.tests) table.push([labName, kind, start, end, t.label, ...labShifts.map(s => t[s] ?? ''), labShifts.every(s => t[s] !== null) ? labShifts.reduce((n, s) => n + (t[s] ?? 0), 0) : 'Partial']);
   download('KAWT-lab-' + start + '.csv', table.map(row => row.map(csvValue).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Report fields check karein'); }
 }
 async function grantAccess() {
  setBusy(true);
  try { const response = await fetch('/api/lab/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: staffEmail, access: 'operator', active: true, laboratory_name: labName }) });const result = await response.json();if (!response.ok) throw new Error(result.error);setMessage('Verified account ko sirf lab department access assign ho gaya.');setStaffEmail(''); }
  catch (error) { setMessage(error instanceof Error ? error.message : 'Access assign nahin hua'); } finally { setBusy(false); }
 }
 async function signOut() { await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signout' }) });router.replace('/lab/login');router.refresh(); }
 const metric = (n: number | null | undefined) => n === null || n === undefined ? '—' : n.toLocaleString('en-GB');
 const denominator = stats ? shift === 'total' ? stats.testTotal : stats.tests[shift] : 0;
 return <main className="mx-auto max-w-7xl px-4 py-7 text-emerald-950">
  <style>{'@media print{.lab-no-print{display:none!important}.lab-scroll{overflow:visible!important}table{font-size:10px}tr{break-inside:avoid}input,select,textarea{border:0!important;box-shadow:none!important}thead{display:table-header-group}}'}</style>
  <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest">Khidmat-e-Alam Medical Centre · Laboratory</p><h1 className="mt-2 font-serif text-3xl">Lab entry aur performance</h1><p className="mt-2 text-sm text-slate-600">Private department workspace · {access === 'viewer' ? 'Read only' : 'Entry aur audited corrections'}</p></div><div className="lab-no-print flex flex-wrap gap-2">{access === 'admin' && <a className={buttonClass} href="/dashboard">Overall dashboard</a>}<button className={buttonClass} onClick={signOut}>Sign out</button></div></header>
  <div className="lab-no-print mb-5 flex flex-wrap gap-2"><select aria-label="Saved reports" className={inputClass + ' max-w-md'} value={id ?? ''} onChange={e => openReport(e.target.value)}><option value="">Saved report kholein</option>{reports.map(r => <option key={r.id} value={r.id}>{r.laboratory_name} · {r.period_start} — {r.period_end} · {r.period_kind}</option>)}</select>{canWrite && <button className={buttonClass} onClick={newReport}>Nayi entry</button>}<a className={buttonClass} href={'/lab/reports' + (start && end ? '?' + new URLSearchParams({ kind, start, end, laboratory_name: labName }) : '')}>Performance reports</a><button className={buttonClass} onClick={() => window.print()}>Print / PDF</button><button className={buttonClass} disabled={!savedMatches} onClick={() => { if (id && savedMatches) { const anchor = document.createElement('a');anchor.href = '/api/lab/export?id=' + encodeURIComponent(id);anchor.download = 'KAWT-lab-' + start + '.xlsx';anchor.click(); } }}>Excel .xlsx</button><button className={buttonClass} onClick={() => exportReport('csv')}>Draft CSV</button><button className={buttonClass} onClick={() => exportReport('json')}>JSON export</button>{id && <a className={buttonClass} href={'https://wa.me/?text=' + encodeURIComponent('KAWT lab report — authorized login darkar hai: ' + window.location.origin + '/lab')} target="_blank" rel="noreferrer">WhatsApp link share</a>}</div>
  {message && <p role="status" className="mb-5 rounded-lg border border-emerald-900/20 bg-white p-3 text-sm">{message}</p>}
  <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="mb-4 font-serif text-xl">Report period</h2><label className="mb-4 block text-sm">Laboratory / source unit<input className={inputClass} value={labName} disabled={access !== 'admin'} onChange={e => setLabName(e.target.value)} maxLength={180} /></label><div className="grid gap-4 sm:grid-cols-4"><label className="text-sm">Qisam<select disabled={!canWrite} value={kind} onChange={e => setKind(e.target.value as typeof kind)} className={inputClass}>{[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['half_year', 'Half yearly'], ['year', 'Annual']].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label className="text-sm">Shuru ki asal date<input type="date" className={inputClass} disabled={!canWrite} value={start} onChange={e => { setStart(e.target.value);if (kind === 'day') setEnd(e.target.value); }} /></label><label className="text-sm">Aakhri date<input type="date" className={inputClass} disabled={!canWrite || kind === 'day'} value={end} onChange={e => setEnd(e.target.value)} /></label><label className="text-sm">Source / entry reference<input className={inputClass} disabled={!canWrite} value={source} onChange={e => setSource(e.target.value)} maxLength={240} /></label></div><p className="mt-3 text-xs text-slate-500">Asia/Karachi · Monthly/annual source se daily records nahin banaye jate. Khaali count not reported hai, zero nahin.</p></section>
  <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Main report tests', stats && labShifts.some(s => stats.observed[s]) ? stats.testTotal : undefined], ['Reported patient count', stats?.patientObserved ? stats.patientTotal : undefined], ['Activity wale test rows', stats?.active], ['Explicit zero test rows', stats?.zero]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 font-serif text-3xl font-bold">{metric(value as number | undefined)}</p></div>)}</section>
  {stats && !stats.complete && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Partial entry: yeh ab tak reported counts hain. Khaali shifts ko zero nahin maana gaya.</p>}
  <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="mb-4 font-serif text-xl">Morning · Evening · Night</h2><div className="lab-scroll overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Shift</th><th>Reported patients</th><th>Tests</th><th>Reported tests ka share</th></tr></thead><tbody>{labShifts.map(s => <tr key={s} className="border-b"><td className="p-2">{labels[s]}</td><td><input aria-label={labels[s] + ' patient count'} type="number" min="0" step="1" value={patients[s]} disabled={!canWrite} className={inputClass + ' max-w-28'} onChange={e => setPatients(p => ({ ...p, [s]: e.target.value }))} placeholder="Not reported" /></td><td>{metric(stats?.observed[s] ? stats.tests[s] : undefined)}</td><td>{stats?.observed[s] && stats.testTotal ? ((stats.tests[s] / stats.testTotal) * 100).toFixed(2) + '%' : '—'}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">Patient count alag darj karein; ek patient ke kai tests ho sakte hain. Aggregate se unique individuals nahin nikalte.</p></section>
  <section className="mb-5 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-serif text-xl">Outsource Tests</h2><div className="grid grid-cols-2 gap-3">{(['patients', 'tests'] as const).map(k => <label key={k} className="text-sm">Reported {k}<input className={inputClass} type="number" min="0" step="1" value={outsource[k]} disabled={!canWrite} onChange={e => setOutsource(p => ({ ...p, [k]: e.target.value }))} placeholder="Not reported" /></label>)}</div><p className="mt-3 text-xs text-slate-500">Source ka alag breakdown; main total mein dobara add nahin hota.</p></div><div className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-serif text-xl">Urgent Care · 24/7 Emergency</h2><p className="mb-3 text-xs text-slate-500">Emergency se refer huay lab tests; emergency ke tamam encounters nahin.</p><div className="lab-scroll overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Shift</th><th>Patients</th><th>Tests</th></tr></thead><tbody>{labShifts.map(s => <tr key={s}><td className="py-2">{labels[s]}</td>{(['patients', 'tests'] as const).map(k => <td key={k}><input className={inputClass + ' max-w-24'} aria-label={'Urgent ' + labels[s] + ' ' + k} type="number" min="0" value={urgent[s][k]} disabled={!canWrite} onChange={e => setUrgent(p => ({ ...p, [s]: { ...p[s], [k]: e.target.value } }))} placeholder="—" /></td>)}</tr>)}</tbody></table></div><p className="mt-2 text-sm font-semibold">Reported total: {stats?.urgentObserved ? metric(stats.urgent.patients) : '—'} patients / {stats?.urgentObserved ? metric(stats.urgent.tests) : '—'} tests</p></div></section>
  <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="mb-4 font-serif text-xl">Test-wise entry aur ranking</h2><div className="lab-no-print mb-4 flex flex-wrap gap-2"><input className={inputClass + ' max-w-xs'} aria-label="Search tests" placeholder="Test talash karein" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Ratio shift" className={inputClass + ' max-w-40'} value={shift} onChange={e => setShift(e.target.value as typeof shift)}><option value="total">Tamam shifts</option>{labShifts.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select><select aria-label="Sort tests" className={inputClass + ' max-w-40'} value={sort} onChange={e => setSort(e.target.value)}><option value="desc">Zyada se kam</option><option value="asc">Kam se zyada</option><option value="name">Naam A–Z</option></select>{canWrite && <button className={buttonClass} onClick={() => setRows(r => [...r, { label: '', ...blankShifts() }])}>Test row add karein</button>}</div><datalist id="laboratory-tests">{catalogue.map(t => <option key={t.category + t.label} value={t.label}>{t.category}</option>)}</datalist><div className="lab-scroll overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-emerald-50"><th className="p-2">Test</th>{labShifts.map(s => <th key={s} className="p-2">{labels[s]}</th>)}<th>Total</th><th>Hissa</th></tr></thead><tbody>{visible.map(row => { const total = labShifts.reduce((n, s) => n + (Number(row[s]) || 0), 0), partial = labShifts.some(s => row[s] === '');return <tr key={row.index} className="border-b"><td className="p-2"><input aria-label={'Test label ' + (row.index + 1)} list="laboratory-tests" value={row.label} disabled={!canWrite} className={inputClass + ' min-w-44'} onChange={e => setRows(r => r.map((t, i) => i === row.index ? { ...t, label: e.target.value } : t))} /></td>{labShifts.map(s => <td key={s} className="p-1"><input type="number" min="0" step="1" aria-label={row.label + ' ' + labels[s]} className={inputClass + ' min-w-20 max-w-28'} value={row[s]} disabled={!canWrite} placeholder="—" onChange={e => setRows(r => r.map((t, i) => i === row.index ? { ...t, [s]: e.target.value } : t))} /></td>)}<td className="p-2">{partial ? 'Partial: ' : ''}{total}</td><td>{denominator ? (((shift === 'total' ? total : Number(row[shift]) || 0) / denominator) * 100).toFixed(2) + '%' : '—'}</td></tr>; })}</tbody></table></div>{!rows.length && <p className="py-6 text-sm text-slate-500">Abhi koi test entry nahin. Asal test ka naam aur reported shift counts add karein.</p>}</section>
  <section className="mb-5 rounded-xl border bg-white p-5"><label className="text-sm">Notes / source ki wazahat<textarea className={inputClass + ' mt-2'} value={notes} disabled={!canWrite} maxLength={2000} onChange={e => setNotes(e.target.value)} /></label>{canWrite && <button className="lab-no-print mt-4 rounded-lg bg-emerald-900 px-6 py-3 font-semibold text-white disabled:opacity-40" disabled={busy} onClick={save}>{busy ? 'Save ho raha hai…' : id ? 'Correction save karein' : 'Report save karein'}</button>}</section>
  {history.length > 0 && <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="font-serif text-xl">Correction history</h2>{history.map((event, i) => <p key={i} className="mt-2 text-sm">Version {event.revision} · {event.action} · {new Date(event.changed_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })}</p>)}</section>}
  {access === 'admin' && <aside className="lab-no-print rounded-xl border bg-white p-5"><h2 className="font-serif text-xl">Administrator tools</h2><label className="mt-4 block text-sm">Historical PDF / Excel / image import — pehle draft review<input className="mt-2 block" type="file" disabled={busy} accept=".pdf,.xlsx,.csv,.json,.png,.jpg,.jpeg" onChange={e => { if (e.target.files?.[0]) importFile(e.target.files[0]);e.target.value = ''; }} /></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={approvedTemplate} onChange={e => setApprovedTemplate(e.target.checked)} />Scanned image approved KAWT 34-test-column format mein hai</label>{candidates.length>0&&<div className="mt-3 rounded-lg border p-3"><label className="text-sm">Extracted reports<select className={inputClass} value={id ? '-1' : candidateIndex} onChange={e=>{const index=Number(e.target.value);if(index<0)return;try{if(!id){const current={...candidates[candidateIndex],laboratory_name:labName,period_kind:kind,period_start:start,period_end:end,source_label:source,payload:payload()};setCandidates(items=>items.map((item,i)=>i===candidateIndex?current:item));}setCandidateIndex(index);showCandidate(candidates[index]);}catch(error){setMessage(error instanceof Error?error.message:'Current counts check karein');}}}>{id&&<option value="-1">Current report saved — next source choose karein</option>}{candidates.map((candidate,i)=><option key={i} value={i}>{candidate.period_start||'Date confirmation required'} — {candidate.period_end} · {candidate.source_label}</option>)}</select></label><ul className="mt-2 list-disc pl-5 text-xs text-amber-900">{[...importWarnings,...candidates[candidateIndex].warnings].map((warning,i)=><li key={i}>{warning}</li>)}</ul>{candidates.length>1&&!id&&<button className={buttonClass+' mt-3'} disabled={busy} onClick={saveCandidates}>Tamam valid source reports save karein</button>}</div>}<div className="mt-5 flex flex-wrap gap-2"><input type="email" className={inputClass + ' max-w-sm'} aria-label="Lab staff email" placeholder="Verified staff account email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} /><button className={buttonClass} disabled={busy || !staffEmail} onClick={grantAccess}>Sirf lab entry access assign karein</button></div><p className="mt-2 text-xs text-slate-500">Existing verified dedicated account required. Is action se account, password ya email message generate nahin hota.</p></aside>}
 </main>;
}
