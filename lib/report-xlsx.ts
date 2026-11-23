import 'server-only';
import { deflateRawSync } from 'node:zlib';
import { labShifts, labTotals, type LabReport } from './laboratory';
import type { LabComparison } from './laboratory-comparison';
type Cell = string | number | null;
function xml(value: string) { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function crc32(bytes: Buffer) {
 let crc = 0xffffffff;
 for (const byte of bytes) { crc ^= byte;for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
 return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: Record<string, string>): Buffer {
 const locals: Buffer[] = [], central: Buffer[] = [];let offset = 0;
 for (const [name, text] of Object.entries(files)) {
  const filename = Buffer.from(name), data = Buffer.from(text), compressed = deflateRawSync(data), crc = crc32(data);
  const header = Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20, 4);header.writeUInt16LE(0x800, 6);header.writeUInt16LE(8, 8);header.writeUInt32LE(crc, 14);header.writeUInt32LE(compressed.length, 18);header.writeUInt32LE(data.length, 22);header.writeUInt16LE(filename.length, 26);
  locals.push(header, filename, compressed);
  const entry = Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20, 4);entry.writeUInt16LE(20, 6);entry.writeUInt16LE(0x800, 8);entry.writeUInt16LE(8, 10);entry.writeUInt32LE(crc, 16);entry.writeUInt32LE(compressed.length, 20);entry.writeUInt32LE(data.length, 24);entry.writeUInt16LE(filename.length, 28);entry.writeUInt32LE(offset, 42);central.push(entry, filename);
  offset += header.length + filename.length + compressed.length;
 }
 const directory = Buffer.concat(central), end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length, 8);end.writeUInt16LE(Object.keys(files).length, 10);end.writeUInt32LE(directory.length, 12);end.writeUInt32LE(offset, 16);
 return Buffer.concat([...locals, directory, end]);
}
function sheet(rows: Cell[][]) {
 const content = rows.map((row, i) => '<row r="' + (i + 1) + '">' + row.map((value, j) => {
  const reference = String.fromCharCode(65 + j) + (i + 1), style = i === 0 ? ' s="1"' : '';
  if (typeof value === 'number') return '<c r="' + reference + '"' + style + '><v>' + value + '</v></c>';
  return '<c r="' + reference + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + xml(value === null ? 'Not reported' : value) + '</t></is></c>';
 }).join('') + '</row>').join('');
 return '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="8" width="23" customWidth="1"/></cols><sheetData>' + content + '</sheetData><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>';
}
export function laboratoryXlsx(report: Omit<Pick<LabReport, 'laboratory_name' | 'period_start' | 'period_end' | 'source_label' | 'payload'>, never> & { period_kind: string; revision: number | string }, comparison?: LabComparison, extraReferrals: { label: string; patients: number; tests: number }[] = []) {
 const p = report.payload, sums = labTotals(p);
 const summary: Cell[][] = [['KAWT Medical Centre', 'Laboratory performance'], ['Period kind', report.period_kind], ['Period start', report.period_start], ['Period end', report.period_end], ['Timezone', 'Asia/Karachi'], ['Source', report.source_label], ['Revision', report.revision], ['Laboratory', report.laboratory_name], [], ['Shift', 'Reported patients', 'Reported tests', 'Coverage']];
 for (const s of labShifts) summary.push([s, p.patients[s], sums.observed[s] ? sums.tests[s] : null, p.tests.every(t => t[s] !== null) && p.patients[s] !== null ? 'Reported rows complete' : 'Partial / not reported']);
 summary.push(['Main report total', sums.patientObserved ? sums.patientTotal : null, labShifts.some(s => sums.observed[s]) ? sums.testTotal : null, sums.complete ? 'Reported rows complete' : 'Partial'], ['Interpretation', 'Aggregate patient counts are not independently verified unique persons'], ['Supplementary groups', 'Outsource and emergency referrals are not added again'], ['Notes', p.notes ?? '']);
 const tests: Cell[][] = [['Source test label', 'Morning', 'Evening', 'Night', 'Reported total', 'Coverage']];
 for (const row of p.tests) tests.push([row.label, row.morning, row.evening, row.night, labShifts.some(s => row[s] !== null) ? labShifts.reduce((n, s) => n + (row[s] ?? 0), 0) : null, labShifts.every(s => row[s] !== null) ? 'Reported rows complete' : 'Partial']);
 const referrals: Cell[][] = [['Source block', 'Shift', 'Reported patients', 'Reported tests'], ['Outsource', 'No source shift split', p.outsource.patients, p.outsource.tests]];
 for (const s of labShifts) referrals.push(['Urgent / 24-7 Emergency lab referrals', s, p.urgent[s].patients, p.urgent[s].tests]);
 for (const row of extraReferrals) referrals.push([row.label, 'Recorded referral subset', row.patients, row.tests]);
 referrals.push(['Boundary', 'Lab referrals; not all emergency encounters'], ['Aggregation', 'Kept separate; no unverified combined total']);
 const names = ['Khulasa', 'Test counts', 'Referrals'], tables = [summary, tests, referrals];
 if (comparison) {
  const heading: Cell[] = ['Metric', 'Current count', 'Previous count', 'Absolute change', 'Change %', 'Interpretation'];
  const row = (label: string, value: LabComparison['totals'][number]): Cell[] => [label, value.current, value.previous, value.change, value.percent, value.note];
  const rows: Cell[][] = [['KAWT', 'Reported volume comparison'], ['Laboratory', report.laboratory_name], ['Current range', comparison.current.start, comparison.current.end], ['Previous range', comparison.previous.start, comparison.previous.end], ['Calendar days', comparison.current.days, comparison.previous.days], ['Source counts', comparison.current.sources, comparison.previous.sources], [], heading];
  for (const value of comparison.totals) rows.push(row(value.label, value));
  rows.push([], heading);
  for (const shift of comparison.shifts) {
   rows.push(row(shift.shift + ' tests', { label: '', ...shift.tests }));
   rows.push(row(shift.shift + ' reported patients', { label: '', ...shift.patients }));
  }
  rows.push([], heading);
  for (const value of comparison.tests) rows.push(row(value.label, value));
  rows.push([], ['Interpretation', comparison.note], ['Missing/partial data', 'Not treated as zero; unavailable comparisons have no numeric percentage']);
  names.push('Period comparison');tables.push(rows);
 }
 const files: Record<string, string> = {
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + names.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>',
  '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + names.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (names.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B503B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
 };
 tables.forEach((rows, i) => { files['xl/worksheets/sheet' + (i + 1) + '.xml'] = sheet(rows); });
 return zip(files);
}
