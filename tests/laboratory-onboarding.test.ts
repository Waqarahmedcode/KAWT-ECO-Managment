import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { staffRequestInput, staffDecisionInput, departmentSignupRedirect } from '../lib/laboratory-onboarding';
const request = () => ({ action: 'request', laboratory_name: ' Main lab ', requested_access: 'operator', message: ' Staff entry ' });
test('Staff may request only bounded Lab access, never a general role or another identity', () => {
 const value = staffRequestInput.parse(request());assert(value.action === 'request');assert.equal(value.laboratory_name, 'Main lab');assert.equal(value.message, 'Staff entry');
 assert(!staffRequestInput.safeParse({ ...request(), role: 'admin' }).success);
 assert(!staffRequestInput.safeParse({ ...request(), user_id: randomUUID() }).success);
 assert(!staffRequestInput.safeParse({ ...request(), requested_access: 'admin' }).success);
 assert(!staffRequestInput.safeParse({ ...request(), laboratory_name: '' }).success);
});
test('Approval requires an assigned department, limited role and current grant revision', () => {
 const value = { id: randomUUID(), revision: 1, status: 'approved', laboratory_name: 'Assigned laboratory', granted_access: 'viewer', current_grant_revision: null, decision_note: '' };
 assert(staffDecisionInput.safeParse(value).success);
 assert(!staffDecisionInput.safeParse({ ...value, current_grant_revision: undefined }).success);
 assert(!staffDecisionInput.safeParse({ ...value, current_grant_revision: 0 }).success);
 assert(!staffDecisionInput.safeParse({ ...value, granted_access: 'admin' }).success);
 assert(!staffDecisionInput.safeParse({ ...value, laboratory_name: undefined }).success);
});
test('Rejection requires a reason and withdrawal requires a saved revision', () => {
 const value = { id: randomUUID(), revision: 2, status: 'rejected', decision_note: '' };
 assert(!staffDecisionInput.safeParse(value).success);
 assert(staffDecisionInput.safeParse({ ...value, decision_note: 'Contact department supervisor' }).success);
 assert(staffRequestInput.safeParse({ action: 'withdraw', id: value.id, revision: 2 }).success);
 assert(!staffRequestInput.safeParse({ action: 'withdraw', id: value.id }).success);
});
test('Department signup confirmation returns to the same site access page without credentials in the URL', () => {
 const url = new URL(departmentSignupRedirect('https://kawt-eco-managment-preview.netlify.app'));
 assert.equal(url.origin, 'https://kawt-eco-managment-preview.netlify.app');assert.equal(url.pathname, '/auth/callback');assert.equal(url.searchParams.get('next'), '/lab/access');assert.equal([...url.searchParams].length, 1);
 const local = new URL(departmentSignupRedirect('http://127.0.0.1:3020/login'));assert.equal(local.pathname, '/auth/callback');assert.equal(local.origin, 'http://127.0.0.1:3020');
});
