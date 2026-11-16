// Drizzle type-safe mapping of the main operational tables.
// The PostgreSQL migration files remain authoritative for triggers, CHECK constraints and RLS.
import { pgTable, pgEnum, text, uuid, integer, smallint, bigint, numeric, timestamp, boolean, date, jsonb, bigserial } from 'drizzle-orm/pg-core';
export const roleEnum=pgEnum('app_role',['admin','camp_manager','doctor','pharmacist','donor','csr_partner']);
export const campStatusEnum=pgEnum('camp_status',['planned','site_review','approved','in_progress','completed','cancelled']);
export const fundEnum=pgEnum('fund_type',['ZAKAT','GENERAL']);
export const expenseEnum=pgEnum('expense_type',['MEDICINE','DIAGNOSTIC','HONORARIUM','TRANSPORT','VENUE','CATERING','FUEL','PHOTOGRAPHY','EQUIPMENT','OTHER']);
export const referralEnum=pgEnum('referral_status',['issued','scheduled','arrived','completed','cancelled','unreachable']);
export const profiles=pgTable('profiles',{id:uuid('id').primaryKey(),role:roleEnum('role').notNull(),displayName:text('display_name'),email:text('email')});
export const camps=pgTable('camps',{
 id:text('id').primaryKey(),title:text('title').notNull(),campDate:date('camp_date'),
 area:text('area').notNull(),address:text('address'),partner:text('partner'),organizer:text('organizer'),
 selectionReason:text('selection_reason'),status:campStatusEnum('status').notNull(),
 hazardAssessment:jsonb('hazard_assessment'),sourceType:text('source_type')
});
export const historicalStatistics=pgTable('historical_camp_statistics',{
 campId:text('camp_id').primaryKey(),totalPatients:integer('total_patients').notNull(),
 maleRecorded:integer('male_recorded'),femaleRecorded:integer('female_recorded'),
 childrenRecorded:integer('children_recorded'),adultsRecorded:integer('adults_recorded'),elderlyRecorded:integer('elderly_recorded'),
 emergenciesRecorded:integer('emergencies_recorded'),referralsRecorded:integer('referrals_recorded'),pregnantRecorded:integer('pregnant_recorded'),
 teamCounts:jsonb('team_counts'),historicalVitals:jsonb('historical_vitals'),
 totalSpendPaisa:bigint('total_spend_paisa',{mode:'number'}).notNull(),
 zakatSpendPaisa:bigint('zakat_spend_paisa',{mode:'number'}).notNull(),
 generalSpendPaisa:bigint('general_spend_paisa',{mode:'number'}).notNull(),
 medicineUnitsReported:integer('medicine_units_reported'),notes:text('notes'),dataNote:text('data_note'),
 sourceName:text('source_name').notNull(),verificationStatus:text('verification_status').notNull()
});
export const campPatients=pgTable('camp_patients',{
 id:uuid('id').primaryKey(),uid:text('uid').notNull(),campId:text('camp_id').notNull(),
 displayName:text('display_name'),email:text('email'),ageYears:smallint('age_years').notNull(),ageBand:text('age_band'),
 gender:text('gender').notNull(),pregnancyStatus:text('pregnancy_status'),
 bpSystolic:smallint('bp_systolic'),bpDiastolic:smallint('bp_diastolic'),
 glucose:numeric('blood_glucose_mg_dl'),bmi:numeric('bmi'),
 consentRecorded:boolean('consent_recorded'),isEmergency:boolean('is_emergency'),clientRequestId:uuid('client_request_id'),createdBy:uuid('created_by'),registrationTime:timestamp('registration_time',{withTimezone:true})
});
export const eligibility=pgTable('patient_eligibility',{
 id:uuid('id').primaryKey(),patientId:uuid('camp_patient_id').notNull(),eligibleForZakat:boolean('eligible_for_zakat').notNull(),
 screeningReference:text('screening_reference').notNull(),subsidyPercent:smallint('subsidy_percent'),approvedBy:uuid('approved_by').notNull(),revokedAt:timestamp('revoked_at',{withTimezone:true})
});
export const consultations=pgTable('camp_consultations',{
 id:uuid('id').primaryKey(),patientId:uuid('patient_id').notNull(),campId:text('camp_id').notNull(),
 clinicianId:uuid('clinician_id').notNull(),chiefComplaint:text('chief_complaint'),clinicalNote:text('clinical_note')
});
export const diagnoses=pgTable('camp_consultation_diagnoses',{
 id:bigserial('id',{mode:'number'}).primaryKey(),consultationId:uuid('consultation_id').notNull(),
 category:text('category').notNull(),clinicalCode:text('clinical_code'),primaryDiagnosis:boolean('primary_diagnosis')
});
export const inventory=pgTable('camp_pharmacy_inventory',{
 id:uuid('id').primaryKey(),campId:text('camp_id').notNull(),medicineId:uuid('medicine_id').notNull(),
 openingUnits:integer('opening_units').notNull(),procuredUnits:integer('procured_units').notNull(),
 dispensedUnits:integer('dispensed_units').notNull(),wastageUnits:integer('wastage_units').notNull(),
 closingUnits:integer('closing_units')
});
export const dispensations=pgTable('camp_pharmacy_dispensations',{
 id:uuid('id').primaryKey(),inventoryId:uuid('inventory_id').notNull(),patientId:uuid('patient_id').notNull(),
 units:integer('units').notNull(),dispensedBy:uuid('dispensed_by').notNull()
});
export const roster=pgTable('camp_staff_roster',{
 id:uuid('id').primaryKey(),campId:text('camp_id').notNull(),staffName:text('staff_name').notNull(),
 role:text('role').notNull(),honorariumPaisa:bigint('honorarium_paisa',{mode:'number'}).notNull(),
 payoutStatus:text('payout_status'),dutyUnits:integer('duty_units'),ratePaisa:bigint('rate_paisa',{mode:'number'})
});
export const financialLedgers=pgTable('camp_financial_ledgers',{
 id:uuid('id').primaryKey(),campId:text('camp_id').notNull(),fund:fundEnum('fund').notNull(),
 expense:expenseEnum('expense').notNull(),amountPaisa:bigint('amount_paisa',{mode:'number'}).notNull(),
 patientId:uuid('patient_id'),eligibilityId:uuid('eligibility_id'),invoiceStoragePath:text('invoice_storage_path'),
 postedBy:uuid('posted_by').notNull(),direction:smallint('direction'),reversalOf:uuid('reversal_of')
});
export const referrals=pgTable('centre_referrals',{
 id:uuid('id').primaryKey(),patientId:uuid('patient_id').notNull(),campId:text('camp_id').notNull(),
 service:text('service').notNull(),status:referralEnum('status').notNull(),referralCode:text('referral_code').notNull(),
 issuedBy:uuid('issued_by').notNull(),completedAt:timestamp('completed_at',{withTimezone:true})
});
export const donors=pgTable('donors',{
 id:uuid('id').primaryKey(),authUserId:uuid('auth_user_id'),fullName:text('full_name'),email:text('email'),
 country:text('country'),marketingConsent:boolean('marketing_consent')
});
export const donations=pgTable('donations',{
 id:uuid('id').primaryKey(),donorId:uuid('donor_id'),campId:text('camp_id'),
 fund:fundEnum('fund').notNull(),currency:text('currency').notNull(),amountMinorUnits:bigint('amount_minor_units',{mode:'number'}).notNull(),
 provider:text('provider').notNull(),providerPaymentId:text('provider_payment_id'),status:text('status').notNull()
});
export const capitalProjects=pgTable('capital_projects',{
 id:uuid('id').primaryKey(),phase:smallint('phase').notNull(),title:text('title').notNull(),
 startYear:smallint('start_year').notNull(),endYear:smallint('end_year').notNull(),
 targetPaisa:bigint('target_paisa',{mode:'number'}),raisedPaisa:bigint('raised_paisa',{mode:'number'}).notNull(),status:text('status').notNull()
});
