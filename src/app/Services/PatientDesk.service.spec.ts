import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
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
});
