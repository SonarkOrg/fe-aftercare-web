import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { deskPatient } from '../testing/fixtures';
import { PatientDeskService } from './PatientDesk.service';

describe('PatientDeskService', () => {
  let service: PatientDeskService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PatientDeskService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('setConsent PUTs { contactConsent } to /patients/{id}/contact-consent', () => {
    let got: unknown;
    service.setConsent(12, 'GRANTED').subscribe(v => (got = v));
    const req = http.expectOne(`${environment.apiUrl}/patients/12/contact-consent`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ contactConsent: 'GRANTED' });
    req.flush({ contactConsent: 'GRANTED' });
    expect(got).toEqual({ contactConsent: 'GRANTED' });
  });

  it('setConsent can record a refusal', () => {
    service.setConsent(12, 'WITHDRAWN').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/patients/12/contact-consent`);
    expect(req.request.body).toEqual({ contactConsent: 'WITHDRAWN' });
    req.flush({ contactConsent: 'WITHDRAWN' });
  });

  it('search POSTs the body to /patients/search; the health number is in the body, never the URL', () => {
    let got: unknown;
    service.search({ healthNumber: 'ZZZZ00010199' }).subscribe(v => (got = v));
    const req = http.expectOne(`${environment.apiUrl}/patients/search`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ healthNumber: 'ZZZZ00010199' });
    expect(req.request.urlWithParams).not.toContain('ZZZZ');
    req.flush({ mode: 'HEALTH_NUMBER', matches: [], candidates: [], warnings: [] });
    expect((got as { mode: string }).mode).toBe('HEALTH_NUMBER');
  });

  it('search sends the name, date and phone forms unchanged', () => {
    for (const body of [{ query: 'trem mar', dateOfBirth: '1968-04-12' }, { phoneDigits: '0199' }]) {
      service.search(body).subscribe();
      const req = http.expectOne(`${environment.apiUrl}/patients/search`);
      expect(req.request.body).toEqual(body);
      req.flush({ mode: 'NAME', matches: [], candidates: [], warnings: [] });
    }
  });

  it('quickCreate POSTs to /patients/quick', () => {
    const body = { firstName: 'Zzz-Test', lastName: 'Arrivee', dateOfBirth: '1990-01-15', confirmNew: true };
    service.quickCreate(body).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/patients/quick`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ patient: deskPatient(), warnings: [] });
  });

  it('setHealthCard PUTs to /patients/{id}/health-card', () => {
    const body = { cardExpiry: '2027-03', seen: true };
    service.setHealthCard(12, body).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/patients/12/health-card`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ card: { onFile: true, expiry: '2027-03', status: 'OK', seenAt: null, expirySource: 'STAFF' }, warnings: [] });
  });

  it('removeHealthCard DELETEs /patients/{id}/health-card', () => {
    service.removeHealthCard(12).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/patients/12/health-card`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ card: { onFile: false, expiry: null, status: 'NONE', seenAt: null, expirySource: null }, warnings: [] });
  });

  it('flagDuplicate POSTs { otherPatientId }', () => {
    service.flagDuplicate(12, 15).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/patients/12/duplicate-flags`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ otherPatientId: 15 });
    req.flush({ id: 1, patientId: 12, otherPatientId: 15, flaggedAt: '2026-10-14T13:00:00Z' });
  });

  it('duplicateFlags GETs /patients/duplicate-flags?status=OPEN', () => {
    service.duplicateFlags().subscribe();
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/patients/duplicate-flags`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('OPEN');
    req.flush([]);
  });

  it('clearDuplicateFlag POSTs to /patients/{id}/duplicate-flags/{flagId}/clear', () => {
    service.clearDuplicateFlag(12, 3).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/patients/12/duplicate-flags/3/clear`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
