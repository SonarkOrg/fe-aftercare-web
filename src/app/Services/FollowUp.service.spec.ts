import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { FollowUpService } from './FollowUp.service';

describe('FollowUpService', () => {
  let service: FollowUpService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(FollowUpService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('create POSTs to /patients/:id/follow-ups', () => {
    const body = { specialty: 'VISCERAL_SURGERY' as const, dischargeDate: '2026-10-10', durationDays: 7 };
    service.create(5, body).subscribe();
    const req = http.expectOne(`${api}/patients/5/follow-ups`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('listForPatient GETs /patients/:id/follow-ups', () => {
    service.listForPatient(5).subscribe();
    const req = http.expectOne(`${api}/patients/5/follow-ups`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('regenerateCode POSTs {} to /follow-ups/:id/access-code', () => {
    service.regenerateCode(11).subscribe();
    const req = http.expectOne(`${api}/follow-ups/11/access-code`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('close POSTs {} to /follow-ups/:id/close', () => {
    service.close(11).subscribe();
    const req = http.expectOne(`${api}/follow-ups/11/close`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('checkInsForPatient GETs /patients/:id/check-ins', () => {
    service.checkInsForPatient(5).subscribe();
    const req = http.expectOne(`${api}/patients/5/check-ins`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
