import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { SEED_RULES, JANE, followUp, providePermissions } from '../testing/fixtures';
import { addDays, businessToday } from '../shared/link.util';
import { CareDataService } from './CareData.service';

describe('CareDataService', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let svc: CareDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [providePermissions('NURSE')], imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(CareDataService);
  });
  afterEach(() => http.verify());

  it('assembles the snapshot from 4 feeds plus one definition request', () => {
    const today = businessToday();
    let snap: any;
    svc.load().subscribe(s => (snap = s));
    http.expectOne(`${api}/patients`).flush([
      { ...JANE, activeFollowUp: followUp({ dischargeDate: addDays(today, -3), endDate: addDays(today, 4) }) },
      { ...JANE, id: 6, firstName: 'Bob', activeFollowUp: followUp({ id: 12, patientId: 6 }) }]);
    http.expectOne(r => r.url === `${api}/alerts`).flush([]);
    const ci = http.expectOne(r => r.url === `${api}/check-ins`);
    expect(ci.request.params.get('from')).toBe(addDays(today, -30));
    expect(ci.request.params.get('to')).toBe(today);
    ci.flush([]);
    const ap = http.expectOne(r => r.url === `${api}/appointments`);
    expect(ap.request.params.get('from')).toBe(today);
    expect(ap.request.params.get('to')).toBe(addDays(today, 30));
    ap.flush([]);
    // both patients share definition 7: one request
    http.expectOne(`${api}/questionnaires/7`).flush({ id: 7, rules: SEED_RULES, questionnaire: {} });
    expect(snap.today).toBe(today);
    expect(snap.rows.length).toBe(2);
    expect(snap.rows[0].painThreshold).toBe(7);
  });

  it('skips the definition request when nobody has a follow-up', () => {
    let snap: any;
    svc.load().subscribe(s => (snap = s));
    http.expectOne(`${api}/patients`).flush([JANE]);
    http.expectOne(r => r.url === `${api}/alerts`).flush([]);
    http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    expect(snap.rows[0].status).toBe('INACTIVE');
  });

  it('a failed questionnaire definition does not fail the snapshot (no thresholds) and is not cached', () => {
    const today = businessToday();
    let snap: any;
    let failed = false;
    svc.load().subscribe({ next: s => (snap = s), error: () => (failed = true) });
    http.expectOne(`${api}/patients`).flush([{ ...JANE, activeFollowUp: followUp({ dischargeDate: addDays(today, -3), endDate: addDays(today, 4) }) }]);
    http.expectOne(r => r.url === `${api}/alerts`).flush([]);
    http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    http.expectOne(`${api}/questionnaires/7`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(failed).toBeFalse();
    expect(snap.rows.length).toBe(1);
    expect(snap.rows[0].painThreshold).toBeNull();
    // second load retries the definition instead of replaying the cached failure
    svc.load().subscribe(s => (snap = s));
    http.expectOne(`${api}/patients`).flush([{ ...JANE, activeFollowUp: followUp({ dischargeDate: addDays(today, -3), endDate: addDays(today, 4) }) }]);
    http.expectOne(r => r.url === `${api}/alerts`).flush([]);
    http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    http.expectOne(`${api}/questionnaires/7`).flush({ id: 7, rules: SEED_RULES, questionnaire: {} });
    expect(snap.rows[0].painThreshold).toBe(7);
  });

  it('without CLINICAL_READ it asks only for the patients and the schedule (no alerts, no check-ins)', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [providePermissions('RECEPTION')], imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(CareDataService);
    let snap: any;
    svc.load().subscribe(s => (snap = s));
    http.expectOne(`${api}/patients`).flush([{ ...JANE, activeFollowUp: null, unresolvedAlertCount: null }]);
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    http.expectNone(r => r.url === `${api}/alerts`);
    http.expectNone(r => r.url === `${api}/check-ins`);
    http.expectNone(r => r.url.startsWith(`${api}/questionnaires`));
    expect(snap.rows.length).toBe(1);
    expect(snap.alerts).toEqual([]);
    expect(snap.checkIns).toEqual([]);
  });
});
