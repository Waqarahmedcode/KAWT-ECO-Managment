import { labPayloadSchema, labReportSchema, labShifts, labTotals, mainLaboratoryName, validDate, validLabPeriod, type LabPayload, type LabPeriodKind } from './laboratory';

export type ImportedLabDraft = {
 laboratory_name: string; period_kind: LabPeriodKind | null; period_start: string; period_end: string;
 source_label: string; entry_mode: 'historical_import'; payload: LabPayload; warnings: string[];
};
export type ImportContext = { laboratory_name?: string; kind?: string; start?: string; end?: string; approvedTemplate?: boolean };
type Period = { period_kind: LabPeriodKind; period_start: string; period_end: string };
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const names = ['morning','evening','night','total'] as const;
const templateTop = ['CBC','Blood Group','ESR','PT','APTT','ICTMP','Dengue Combo','NS1','Dengue IGM,IGG','Hbsag ICT','Hcv ICT','H.pyloriAB ICT','T.dot','U.PT','Trop I','CRP','RA','ASOT'];
const templateBottom = ['Glucouse','Urea','Creatinine','Uric acid','Calcium','Sgpt','Alk.ph','GGT','Bilurbin T/D','LFT','Lipid Profile','Cholestrol','Triglecyrides','Urine DR','Stool DR','HPSA'];
const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').trim();
function integer(value: unknown): number | null {
 if (value === null || value === undefined || text(value) === '' || /^(not reported|—|partial)$/i.test(text(value))) return null;
 const clean = text(value).replace(/,/g, '');
 if (!/^\d+$/.test(clean) || !Number.isSafeInteger(Number(clean)) || Number(clean) > 99_999_999) throw new Error('Count readable poora number nahin: ' + text(value).slice(0, 40));
 return Number(clean);
}
function blank(): LabPayload { return { tests: [], patients: { morning: null, evening: null, night: null }, outsource: { patients: null, tests: null }, urgent: { morning: { patients: null, tests: null }, evening: { patients: null, tests: null }, night: { patients: null, tests: null } } }; }
function explicitPeriod(kind: string, start: string, end: string): Period | null {
 if (['day','week','month','half_year','year'].includes(kind) && validLabPeriod(kind as LabPeriodKind, start, end)) return { period_kind: kind as LabPeriodKind, period_start: start, period_end: end };
 return null;
}
export function sourcePeriod(source: string): Period | null {
 const raw = source.trim(), dateLine = raw.match(/\b(?:Date|Reporting\s+(?:month|period)|Month)\b\s*[:\-]?\s*([^\n]+)/i)?.[1] ?? raw;
 const month = dateLine.match(new RegExp('\\b(' + monthNames.join('|') + ')\\s+(20\\d{2}|19\\d{2}|21\\d{2})\\b', 'i'));
 const namedDay = dateLine.match(new RegExp('\\b(\\d{1,2})\\s+(' + monthNames.join('|') + ')\\s+(\\d{4})\\b', 'i'));
 if (namedDay) {
  const m = monthNames.findIndex(n => n.toLowerCase() === namedDay[2].toLowerCase()) + 1;
  const date = namedDay[3] + '-' + String(m).padStart(2, '0') + '-' + namedDay[1].padStart(2, '0');
  return validDate(date) ? { period_kind: 'day', period_start: date, period_end: date } : null;
 }
 const iso = dateLine.match(/^\s*(\d{4}-\d{2}-\d{2})\s*$/)?.[1];
 if (iso && validDate(iso)) return { period_kind: 'day', period_start: iso, period_end: iso };
 const yearMonth = dateLine.match(/^\s*(\d{4})-(0[1-9]|1[0-2])\s*$/);
 if (month || yearMonth) {
  const year = month ? month[2] : yearMonth![1], m = month ? monthNames.findIndex(n => n.toLowerCase() === month[1].toLowerCase()) + 1 : Number(yearMonth![2]);
  const start = year + '-' + String(m).padStart(2, '0') + '-01', end = new Date(Date.UTC(Number(year), m, 0)).toISOString().slice(0, 10);
  return explicitPeriod('month', start, end);
 }
 return null;
}
function makeDraft(payload: LabPayload, period: Period | null, source: string, context: ImportContext, warnings: string[]): ImportedLabDraft {
 const fallback = context.kind && context.start && context.end ? explicitPeriod(context.kind, context.start, context.end) : null;
 if (!period && fallback) warnings.push('Source period nahin mila; operator-selected period use hua. Save se pehle source se check karein.');
 if (period && fallback && (period.period_start !== fallback.period_start || period.period_end !== fallback.period_end)) warnings.push('Source dates selected form dates se mukhtalif thin; source ka period preserve hua.');
 const resolved = period ?? fallback;
 if (!resolved) warnings.push('Asal reporting period source se confirm nahin hua; date/grain manually select kiye baghair Save nahin ho sakta.');
 warnings.push('Filename ko service date nahin maana gaya. Extracted counts review karein; abhi save nahin huay.');
 return { laboratory_name: context.laboratory_name || mainLaboratoryName, period_kind: resolved?.period_kind ?? null, period_start: resolved?.period_start ?? '', period_end: resolved?.period_end ?? '', source_label: source.slice(0, 240), entry_mode: 'historical_import', payload: labPayloadSchema.parse(payload), warnings };
}
/** Native KAWT two-block laboratory sheet. Unknown layouts are not guessed. */
export function parseLabPerformanceText(raw: string, source: string, context: ImportContext = {}): ImportedLabDraft {
 const lines = raw.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
 const numericRows: { index: number; shift: typeof names[number]; values: number[] }[] = [];
 lines.forEach((line, index) => {
  const match = line.match(/^(Morning|Evening|Night|Total)\s+(.+)$/i);
  if (!match) return;
  const cells = match[2].split(/[\s|]+/).filter(Boolean);
  if (!cells.length || cells.some(cell => !/^\d[\d,]*$/.test(cell))) return;
  numericRows.push({ index, shift: match[1].toLowerCase() as typeof names[number], values: cells.map(cell => integer(cell)!) });
 });
 const groups: typeof numericRows[] = [];
 for (let i = 0; i + 3 < numericRows.length; i++) if (names.every((name, n) => numericRows[i + n].shift === name)) { groups.push(numericRows.slice(i, i + 4));i += 3; }
 if (groups.length !== 2) throw new Error('Lab count table ka format clear nahin mila. Khaali test-request form ko performance counts nahin banaya gaya; actual counts sheet ya structured Excel use karein.');
 const warnings: string[] = [], payload = blank();
 let topHeaderStart = -1;
 for (let i = 0; i < groups[0][0].index; i++) if (/^Day\s*:?(?:\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?$/i.test(lines[i])) topHeaderStart = i;
 let firstLabels = lines.slice(topHeaderStart + 1, groups[0][0].index);
 const lowerHeaders = lines.slice(groups[0][3].index + 1, groups[1][0].index), stop = lowerHeaders.findIndex(line => /^Total\s+No/i.test(line));
 let secondLabels = stop >= 0 ? lowerHeaders.slice(0, stop) : lowerHeaders;
 if (firstLabels.length !== groups[0][0].values.length || !secondLabels.length || groups[1][0].values.length - secondLabels.length !== 4) {
  if (!context.approvedTemplate || groups[0][0].values.length !== 18 || groups[1][0].values.length !== 20) throw new Error('Test column labels reliably map nahin huay. Source verify karke approved KAWT 34-column template select karein, ya structured Excel use karein.');
  firstLabels = templateTop;secondLabels = templateBottom;warnings.push('Column labels operator-selected approved 34-column template se map huay; source image se har column verify karein.');
 }
 for (const [i, labels] of [firstLabels, secondLabels].entries()) {
  const group = groups[i], length = group[0].values.length;
  if (group.some(row => row.values.length !== length)) throw new Error('Shift row ke column counts aapas mein match nahin karte; source correction darkar hai.');
  labels.forEach((label, col) => {
   const row = { label, morning: group[0].values[col], evening: group[1].values[col], night: group[2].values[col] };
   if (row.morning + row.evening + row.night !== group[3].values[col]) warnings.push(label + ': shift sum printed total se match nahin. Source total ' + group[3].values[col] + '.');
   payload.tests.push(row);
  });
 }
 const offset = secondLabels.length;
 labShifts.forEach((shift, i) => {
  const values = groups[1][i].values;
  payload.patients[shift] = values[offset];
  payload.urgent[shift] = { patients: values[offset + 2], tests: values[offset + 3] };
  const actual = payload.tests.reduce((n, row) => n + (row[shift] ?? 0), 0);
  if (actual !== values[offset + 1]) warnings.push(shift + ': calculated tests ' + actual + ', source total ' + values[offset + 1] + '.');
 });
 const total = groups[1][3].values, sums = labTotals(payload);
 if (sums.patientTotal !== total[offset] || sums.testTotal !== total[offset + 1]) warnings.push('Main printed totals aur extracted sums mein farq hai; Save se pehle durust karein.');
 if (sums.urgent.patients !== total[offset + 2] || sums.urgent.tests !== total[offset + 3]) warnings.push('Emergency referral total rows reconcile nahin huin.');
 const outsource = raw.match(/OUTSOURCE\s+TESTS\s+([\d,]+)\s+([\d,]+)/i);
 if (outsource) payload.outsource = { patients: integer(outsource[1]), tests: integer(outsource[2]) };
 else warnings.push('Outsource box reliably extract nahin hua; missing counts null rakhe gaye.');
 payload.notes = 'Extracted source report; main/Outsource/Emergency groups not added together. Source scope and any OCR corrections require review.';
 return makeDraft(payload, sourcePeriod(raw), source, context, warnings);
}
export type ImportSheet = { sheet: string; data: unknown[][] };
export function parseLabSheets(sheets: ImportSheet[], source: string, context: ImportContext = {}): ImportedLabDraft[] {
 const matrices: { sheet: ImportSheet; header: number; label: number; shifts: number[] }[] = [];
 for (const sheet of sheets) for (let i = 0; i < Math.min(sheet.data.length, 60); i++) {
  const header = sheet.data[i].map(normalize), label = header.findIndex(cell => ['test','testname','sourcetestlabel','testlabel','sourcetest'].includes(cell));
  const shifts = labShifts.map(s => header.indexOf(s));
  if (label >= 0 && shifts.every(n => n >= 0)) { matrices.push({ sheet, header: i, label, shifts });break; }
 }
 // Our editable workbook intentionally contains an immutable-looking backup.
 // Import its current counts table once, not both copies of the same source.
 if (matrices.some(m => normalize(m.sheet.sheet) === 'testcounts')) {
  for (let i = matrices.length - 1; i >= 0; i--) if (normalize(matrices[i].sheet.sheet) === 'originalsource') matrices.splice(i, 1);
 }
 if (!matrices.length) throw new Error('Excel mein Test, Morning, Evening aur Night columns nahin mile. Known export layout ya count sheet use karein.');
 const results: ImportedLabDraft[] = [];
 for (const matrix of matrices) {
  const sheetsForContext = matrices.length === 1 ? sheets : [matrix.sheet], allRows = sheetsForContext.flatMap(s => s.data);
  let period: Period | null = null;
  const metadata = new Map(allRows.filter(row => row.length >= 2).map(row => [normalize(row[0]), text(row[1])]));
  if (metadata.has('periodkind') && metadata.has('periodstart') && metadata.has('periodend')) period = explicitPeriod(metadata.get('periodkind')!, metadata.get('periodstart')!, metadata.get('periodend')!);
  period ??= sourcePeriod(matrix.sheet.sheet);
  if (!period && !metadata.has('periodkind')) {
   headerScan: for (const row of allRows.slice(0, 30)) {
    if (/^(source|filename|file|reference|original)/.test(normalize(row[0]))) continue;
    for (const cell of row.slice(0, 3)) { const candidate = sourcePeriod(text(cell));if (candidate) { period = candidate;break headerScan; } }
   }
  }
  const headers = matrix.sheet.data[matrix.header].map(normalize);
  const groups = new Map<string, { payload: LabPayload; period: Period | null; warnings: string[] }>();
  for (const row of matrix.sheet.data.slice(matrix.header + 1)) {
   const label = text(row[matrix.label]);if (!label) continue;if (/^(total|grand total|tamam tests ka total)$/i.test(label)) break;
   const startIndex = headers.indexOf('periodstart'), endIndex = headers.indexOf('periodend'), kindIndex = headers.indexOf('periodkind'), monthIndex = headers.indexOf('sourceperiod'), dateIndex = headers.findIndex(h => ['date','servicedate','reportdate'].includes(h));
   const rowPeriod = startIndex >= 0 && endIndex >= 0 && kindIndex >= 0 ? explicitPeriod(text(row[kindIndex]), text(row[startIndex]), text(row[endIndex])) : monthIndex >= 0 ? sourcePeriod(text(row[monthIndex])) : dateIndex >= 0 ? sourcePeriod('Date: ' + text(row[dateIndex])) : null;
   const selectedPeriod = rowPeriod ?? period, key = selectedPeriod ? selectedPeriod.period_start + '/' + selectedPeriod.period_end : 'unresolved';
   const group = groups.get(key) ?? { payload: blank(), period: selectedPeriod, warnings: [] };
   group.payload.tests.push({ label, morning: integer(row[matrix.shifts[0]]), evening: integer(row[matrix.shifts[1]]), night: integer(row[matrix.shifts[2]]) });groups.set(key, group);
  }
  for (const group of groups.values()) {
   // Summary counts are read only from context that belongs to this period.
   if (groups.size === 1) {
    for (const sheet of sheetsForContext) {
     const rows = sheet.data, patientHeader = rows.findIndex(r => normalize(r[0]) === 'shift' && r.slice(1).some(c => normalize(c).includes('patient')));
     if (patientHeader >= 0) {
      const patientColumn = rows[patientHeader].findIndex(c => normalize(c).includes('patient'));
      for (const row of rows.slice(patientHeader + 1, patientHeader + 5)) {
       const shift = normalize(row[0]);if (labShifts.includes(shift as typeof labShifts[number])) group.payload.patients[shift as typeof labShifts[number]] = integer(row[patientColumn]);
      }
     }
     for (const row of rows) {
      const key = normalize(row[0]), shift = normalize(row[1]);
      if (key === 'outsourcereportedpatients') group.payload.outsource.patients = integer(row[1]);
      else if (key === 'outsourcereportedtests') group.payload.outsource.tests = integer(row[1]);
      else if (key === 'outsource' && row.length >= 4) group.payload.outsource = { patients: integer(row[2]), tests: integer(row[3]) };
      if (key.includes('urgent') && labShifts.includes(shift as typeof labShifts[number])) group.payload.urgent[shift as typeof labShifts[number]] = { patients: integer(row[2]), tests: integer(row[3]) };
     }
    }
   }
   if (labShifts.some(s => group.payload.patients[s] === null)) group.warnings.push('Shift patient counts source se nahin mile; blank ko zero nahin banaya gaya.');
   if (group.payload.outsource.patients === null) group.warnings.push('Outsource counts not reported / separate mapping darkar hai.');
   results.push(makeDraft(group.payload, group.period, source + ' — ' + matrix.sheet.sheet, context, group.warnings));
  }
 }
 return results;
}
export function parseLabCsv(raw: string, source: string, context: ImportContext = {}) {
 const rows: string[][] = [];let row: string[] = [], cell = '', quoted = false;
 for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if (c === '"') { if (quoted && raw[i + 1] === '"') { cell += '"';i++; } else quoted = !quoted; }
  else if (c === ',' && !quoted) { row.push(cell);cell = ''; }
  else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && raw[i + 1] === '\n') i++;row.push(cell);if (row.some(Boolean)) rows.push(row);row = [];cell = ''; }
  else cell += c;
  if (rows.length > 10000 || row.length > 100) throw new Error('CSV bohat bara hai');
 }
 if (quoted) throw new Error('CSV quotes mukammal nahin');
 row.push(cell);if (row.some(Boolean)) rows.push(row);
 return parseLabSheets([{ sheet: 'CSV', data: rows }], source, context);
}
export function parseLabJson(raw: string, source: string, context: ImportContext = {}): ImportedLabDraft[] {
 const parsed: unknown = JSON.parse(raw), items = Array.isArray(parsed) ? parsed : [parsed];
 if (!items.length || items.length > 24) throw new Error('Ek batch mein 1 se 24 reports hon');
 return items.map(item => {
  const report = labReportSchema.parse(item);
  return makeDraft(report.payload, { period_kind: report.period_kind, period_start: report.period_start, period_end: report.period_end }, source, { ...context, laboratory_name: report.laboratory_name }, ['Imported record identity/revision reuse nahin hui; pehle draft review karein.']);
 });
}
