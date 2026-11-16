"""Source audit, not a substitute for running tests against a live PostgreSQL instance."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
camps=json.loads((root/'data/historical-camps.json').read_text())
assert len(camps)==6
assert sorted(c['id'] for c in camps)==[f'FMC-{n:02d}' for n in range(1,7)]
assert sum(c['patients']['total'] for c in camps)==2912
assert sum(c['financials']['totalBudget'] for c in camps)==2416571
assert sum(c['financials']['zakatAmount'] for c in camps)==1863111
assert sum(c['financials']['nonZakatAmount'] for c in camps)==553460
assert sum(c['financials']['medicineUnits'] for c in camps)==26500
issues=[]
for c in camps:
 f,p=c['financials'],c['patients'];code=c['id']
 assert f['totalBudget']==f['zakatAmount']+f['nonZakatAmount'],code
 assert sum(e['amount'] for e in c['expenses'])==f['totalBudget'],code
 assert p['total']>0 and f['totalBudget']>0,code
 gender_gap=p['total']-p['male']-p['female']; age_gap=p['total']-p['children']-p['adults']-p['elderly']
 assert gender_gap>=0 and age_gap>=0,('recorded subtotals exceed total',code)
 if gender_gap:issues.append((code,'gender not independently resolved for all patients',gender_gap))
 if age_gap:issues.append((code,'age classification gap',age_gap))
 if code in ('FMC-04','FMC-05'):
  assert f['medicineUnits']==0
  issues.append((code,'dispensed units UNKNOWN: legacy zero is not a verified zero',None))
 medicine_rows=sum(m['units'] for m in c['medicinesList'])
 if code in ('FMC-02','FMC-03') and f['medicineUnits'] != medicine_rows:
  issues.append((code,'medicine detail is a subset of overall reported units',f['medicineUnits']-medicine_rows))
 if code in ('FMC-04','FMC-06'):
  issues.append((code,'disease distribution is an estimated/pharmacy proxy, not a UID diagnosis',None))
 elif code=='FMC-05':
  assert not c['diseases']
 if code=='FMC-03' and sum(d['cases'] for d in c['diseases']) != p['total']:
  issues.append((code,'disease category counts do not cover every attendee',p['total']-sum(d['cases'] for d in c['diseases'])))
 print(f"{code}: {p['total']} attendees, PKR {f['totalBudget']:,}, demographics gap gender={gender_gap} age={age_gap}")
assert len(issues)>=10
for code,label,value in issues:
 print('DATA QUALITY:',code,label,'' if value is None else value)
print(f'PASS: source arithmetic reconciles; {len(issues)} known quality warnings retained for review.')
