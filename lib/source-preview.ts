import type { CampView } from './dashboard';
import { historicalCamps, plannedCamps } from './source';

/** Source records only. Programme capacity never creates additional camps. */
export function sourcePreviewRows(): CampView[] {
 const historical = historicalCamps.map((camp): CampView => ({
  id: camp.id, name: camp.name, date: camp.date, area: camp.area,
  status: 'completed', source: 'legacy_source', patients: camp.patients.total,
  zakat: camp.financials.zakatAmount, general: camp.financials.nonZakatAmount,
  spend: camp.financials.totalBudget, medicineUnits: camp.financials.medicineUnits,
  emergencies: camp.patients.emergency, referrals: camp.patients.referrals,
  dataNote: camp.dataNote ?? null, maleRecorded: camp.patients.male,
  femaleRecorded: camp.patients.female, childrenRecorded: camp.patients.children,
  adultsRecorded: camp.patients.adults, elderlyRecorded: camp.patients.elderly,
  livePatients: 0,
 }));
 const planned = plannedCamps.map((camp): CampView => ({
  id: camp.code, name: camp.area, date: null, area: camp.area,
  status: 'planned', source: 'legacy_source', patients: 0, zakat: 0,
  general: 0, spend: 0, medicineUnits: 0, emergencies: 0, referrals: 0,
  dataNote: `Source roadmap: ${camp.targetDate}; target ${camp.targetPatients} attendees; proposed budget PKR ${camp.estBudget}. No completed activity is asserted.`,
  maleRecorded: null, femaleRecorded: null, childrenRecorded: null,
  adultsRecorded: null, elderlyRecorded: null, livePatients: 0,
 }));
 return [...historical, ...planned];
}
