'use client';
import { useEffect, useState } from 'react';
import { comparisonQuery, type ComparisonMode, type LabComparison, type VolumeChange } from '@/lib/laboratory-comparison';
import type { LabSummaryQuery } from '@/lib/laboratory-reporting';
import { csvValue } from '@/lib/laboratory';

const control = 'mt-1 w-full rounded-lg border border-emerald-900/20 bg-white p-2 text-sm';
const button = 'rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-sm font-semibold text-emerald-950';
const amount = (value: number | null) => value === null ? 'Not available' : value.toLocaleString('en-GB');
const difference = (value: number | null) => value === null ? '—' : (value > 0 ? '+' : '') + value.toLocaleString('en-GB');
const percent = (value: number | null) => value === null ? '—' : (value > 0 ? '+' : '') + value.toFixed(2) + '%';
function Cells({ value }: { value: VolumeChange }) {
 return <><td className="p-2">{amount(value.current)}</td><td className="p-2">{amount(value.previous)}</td><td className="p-2">{difference(value.change)}</td><td className="p-2 font-semibold">{percent(value.percent)}</td><td className="p-2 text-xs text-slate-600">{value.note}</td></>;
}
function Head({ label }: { label: string }) {
 return <thead><tr className="bg-emerald-50">{[label, 'Current count', 'Previous count', 'Farq', 'Change %', 'Source status'].map(name => <th key={name} className="p-2">{name}</th>)}</tr></thead>;
}
export default function LabComparison({ query }: { query: LabSummaryQuery }) {
 const [mode, setMode] = useState<ComparisonMode>('previous_period');
 const initial = comparisonQuery(query, 'previous_period').query;
 const [start, setStart] = useState(initial?.start ?? ''), [end, setEnd] = useState(initial?.end ?? '');
 const [search, setSearch] = useState('');
 const [state, setState] = useState<{ url: string; data?: LabComparison; error?: string }>({ url: '' });
 const previous = comparisonQuery(query, mode, { start, end });
 const params = new URLSearchParams({ ...query, mode, ...(mode === 'custom' ? { previous_start: start, previous_end: end } : {}) });
 const url = previous.query ? '/api/lab/comparison?' + params : '';
 useEffect(() => {
  if (!url) return;
  const controller = new AbortController();
  fetch(url, { cache: 'no-store', signal: controller.signal }).then(async response => {
   const body = await response.json();if (!response.ok) throw new Error(body.error);return body as LabComparison;
  }).then(data => setState({ url, data })).catch(error => { if (!controller.signal.aborted) setState({ url, error: error.message }); });
  return () => controller.abort();
 }, [url]);
 const data = state.url === url ? state.data : undefined;
 const tests = data?.tests.filter(row => row.label.toLowerCase().includes(search.toLowerCase())) ?? [];
 function exportCsv() {
  if (!data) return;
  const rows: (string | number)[][] = [['Laboratory', query.laboratory_name], ['Current period', data.current.start, data.current.end], ['Previous period', data.previous.start, data.previous.end], ['Metric', 'Current count', 'Previous count', 'Absolute change', 'Change %', 'Source status']];
  const add = (label: string, value: VolumeChange) => rows.push([label, value.current ?? '', value.previous ?? '', value.change ?? '', value.percent ?? '', value.note]);
  data.totals.forEach(value => add(value.label, value));
  if (data.current.found && data.previous.found) {
   data.shifts.forEach(value => { add(value.shift + ' tests', value.tests);add(value.shift + ' reported patients', value.patients); });
   tests.forEach(value => add(value.label, value));
  }
  rows.push(['Interpretation', data.note]);
  const blob = new Blob([rows.map(row => row.map(csvValue).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'), href = URL.createObjectURL(blob);link.href = href;link.download = 'KAWT-comparison-' + query.start + '.csv';link.click();setTimeout(() => URL.revokeObjectURL(href), 1000);
 }
 return <section className="mb-5 rounded-xl border border-emerald-900/15 bg-white p-5" aria-labelledby="period-comparison-heading">
  <h2 id="period-comparison-heading" className="font-serif text-xl">Period comparison</h2>
  <div className="lab-no-print mt-4 grid gap-3 sm:grid-cols-3">
   <label className="text-sm">Muqabla kis period se?<select aria-label="Comparison mode" className={control} value={mode} onChange={e => setMode(e.target.value as ComparisonMode)}><option value="previous_period">Pichla period</option><option value="previous_year">Pichle saal ki same dates</option><option value="custom">Manual comparison range</option></select></label>
   {mode === 'custom' && <><label className="text-sm">Previous From<input aria-label="Comparison from date" type="date" value={start} onChange={e => setStart(e.target.value)} className={control} /></label><label className="text-sm">Previous To<input aria-label="Comparison to date" type="date" value={end} onChange={e => setEnd(e.target.value)} className={control} /></label></>}
  </div>
  {!previous.query && <p role="status" className="mt-4 text-sm text-amber-900">{previous.reason}</p>}
  {url && state.url !== url && <p role="status" className="mt-4 text-sm">Comparison ke source records load ho rahe hain…</p>}
  {url && state.url === url && state.error && <p role="alert" className="mt-4 text-sm text-red-800">{state.error}</p>}
  {data && <>
   <p className="mt-4 text-sm">Current: {data.current.start} — {data.current.end} ({data.current.days} calendar days) · Previous: {data.previous.start} — {data.previous.end} ({data.previous.days} calendar days).</p>
   {(!data.current.found || !data.previous.found) && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Comparison ke liye dono periods ka source data chahiye. Missing period ko zero nahin maana gaya.</p>}
   <div className="lab-no-print my-4 flex flex-wrap gap-2"><button className={button} onClick={() => window.print()}>Print comparison / PDF</button>{data.current.found && <a className={button} href={url + '&format=xlsx'} download>Comparison Excel .xlsx</a>}<button className={button} onClick={exportCsv}>Comparison CSV</button></div>
   <div className="lab-scroll mt-4 overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Overall volume comparison"><Head label="Metric" /><tbody>{data.totals.map(value => <tr key={value.label} className="border-t"><td className="p-2">{value.label}</td><Cells value={value} /></tr>)}</tbody></table></div>
   {data.current.found && data.previous.found && <><h3 className="mt-6 font-semibold">Shift-wise volume comparison</h3>
   <div className="lab-scroll mt-3 overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Shift volume comparison"><Head label="Shift / metric" /><tbody>{data.shifts.flatMap(value => [<tr key={value.shift + '-tests'} className="border-t"><td className="p-2 capitalize">{value.shift} tests</td><Cells value={value.tests} /></tr>, <tr key={value.shift + '-patients'} className="border-t"><td className="p-2 capitalize">{value.shift} reported patients</td><Cells value={value.patients} /></tr>])}</tbody></table></div>
   <div className="my-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Test-wise growth</h3><input aria-label="Comparison test search" className={control + ' lab-no-print max-w-xs'} placeholder="Comparison mein test talash karein" value={search} onChange={e => setSearch(e.target.value)} /></div>
   <div className="lab-scroll overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Test volume comparison"><Head label="Test" /><tbody>{tests.map(value => <tr key={value.label} className="border-t"><td className="p-2">{value.label}</td><Cells value={value} /></tr>)}</tbody></table></div></>}
   <p className="mt-4 text-xs text-slate-600">{data.note}</p>
  </>}
 </section>;
}
