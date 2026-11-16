import historical from '@/data/historical-camps.json';
import roadmap from '@/data/planned-camps.json';
export type LegacyCamp = typeof historical[number];
export const historicalCamps = historical;
export const plannedCamps = roadmap;
export const metrics = () => ({
 completed: historicalCamps.length, planned: 18-historicalCamps.length,
 patients: historicalCamps.reduce((n,c)=>n+c.patients.total,0),
 expenditure: historicalCamps.reduce((n,c)=>n+c.financials.totalBudget,0),
 zakat: historicalCamps.reduce((n,c)=>n+c.financials.zakatAmount,0),
 nonZakat: historicalCamps.reduce((n,c)=>n+c.financials.nonZakatAmount,0),
 medicineUnitsRecorded: historicalCamps.reduce((n,c)=>n+c.financials.medicineUnits,0),
 emergencies: historicalCamps.reduce((n,c)=>n+c.patients.emergency,0),
 referrals: historicalCamps.reduce((n,c)=>n+c.patients.referrals,0),
 doctorsDeployments: historicalCamps.reduce((n,c)=>n+c.team.doctors,0),
 volunteerDeployments: historicalCamps.reduce((n,c)=>n+c.team.volunteers,0)
});
export const formatPKR = (n:number) => 'PKR '+Math.round(n).toLocaleString('en-PK');
