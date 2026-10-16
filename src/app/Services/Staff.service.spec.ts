import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { StaffService } from './Staff.service';

describe('StaffService', () => {
  let http: HttpTestingController;
  let svc: StaffService;
  const url = `${environment.apiUrl}/staff`;
  const req = { displayName: 'A', email: null, role: 'NURSE' as const, accessRole: 'NURSE' as const, auth0Subject: null };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(StaffService);
  });
  afterEach(() => http.verify());

  it('list sends includeInactive', () => {
    svc.list(true).subscribe();
    let r = http.expectOne(x => x.url === url);
    expect(r.request.params.get('includeInactive')).toBe('true');
    r.flush([]);
    svc.list().subscribe();
    r = http.expectOne(x => x.url === url);
    expect(r.request.params.get('includeInactive')).toBe('false');
    r.flush([]);
  });

  it('create, update, deactivate, reactivate', () => {
    svc.create(req).subscribe();
    let r = http.expectOne(url);
    expect([r.request.method, r.request.body]).toEqual(['POST', req]);
    r.flush({});
    svc.update(2, req).subscribe();
    r = http.expectOne(`${url}/2`);
    expect([r.request.method, r.request.body]).toEqual(['PUT', req]);
    r.flush({});
    svc.deactivate(2).subscribe();
    r = http.expectOne(`${url}/2/deactivate`);
    expect(r.request.method).toBe('POST');
    r.flush({});
    svc.reactivate(2).subscribe();
    r = http.expectOne(`${url}/2/reactivate`);
    expect(r.request.method).toBe('POST');
    r.flush({});
  });
});
