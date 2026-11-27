import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AccessLinkService } from './AccessLink.service';

describe('AccessLinkService (PRIV-A-06 contract)', () => {
  const api = environment.apiUrl;
  let svc: AccessLinkService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    svc = TestBed.inject(AccessLinkService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('posts the three revocations with no body', () => {
    const seen: number[] = [];
    svc.revokeFollowUp(3).subscribe(r => seen.push(r.revoked));
    svc.revokeAppointment(4).subscribe(r => seen.push(r.revoked));
    svc.revokeAllForPatient(5).subscribe(r => seen.push(r.revoked));
    for (const [url, n] of [[`${api}/follow-ups/3/access-code/revoke`, 1], [`${api}/appointments/4/access-code/revoke`, 0], [`${api}/patients/5/access-links/revoke`, 3]] as const) {
      const req = http.expectOne(url);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      req.flush({ revoked: n });
    }
    expect(seen).toEqual([1, 0, 3]);
  });
});
