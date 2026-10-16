import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AuditService } from './Audit.service';

describe('AuditService', () => {
  it('GETs the page with page and size (default 50)', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuditService).list(5, 1).subscribe();
    const r = http.expectOne(x => x.url === `${environment.apiUrl}/patients/5/audit`);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('page')).toBe('1');
    expect(r.request.params.get('size')).toBe('50');
    r.flush({ items: [], page: 1, size: 50, hasMore: false });
    http.verify();
  });

  it('adds actorSub to the per-patient request only when given', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const http = TestBed.inject(HttpTestingController);
    const svc = TestBed.inject(AuditService);
    svc.list(5, 0, 50, 'dev|nurse-1').subscribe();
    let r = http.expectOne(x => x.url === `${environment.apiUrl}/patients/5/audit`);
    expect(r.request.params.get('actorSub')).toBe('dev|nurse-1');
    r.flush({ items: [], page: 0, size: 50, hasMore: false });
    svc.list(5, 0, 50, null).subscribe();
    r = http.expectOne(x => x.url === `${environment.apiUrl}/patients/5/audit`);
    expect(r.request.params.has('actorSub')).toBeFalse();
    r.flush({ items: [], page: 0, size: 50, hasMore: false });
    http.verify();
  });

  it('listAll GETs /api/audit with only the filters that are set', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const http = TestBed.inject(HttpTestingController);
    const svc = TestBed.inject(AuditService);
    svc.listAll({ actorSub: 'auth0|doc', action: 'HEALTH_NUMBER_REVEALED', patientId: 5, from: '2026-09-15', to: '2026-10-14' }, 2, 25).subscribe();
    let r = http.expectOne(x => x.url === `${environment.apiUrl}/audit`);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.keys().sort()).toEqual(['action', 'actorSub', 'from', 'page', 'patientId', 'size', 'to']);
    expect(r.request.params.get('actorSub')).toBe('auth0|doc');
    expect(r.request.params.get('action')).toBe('HEALTH_NUMBER_REVEALED');
    expect(r.request.params.get('patientId')).toBe('5');
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.get('size')).toBe('25');
    r.flush({ items: [], page: 2, size: 25, hasMore: false });
    svc.listAll({ actorSub: null, action: null, patientId: null, from: '', to: undefined }).subscribe();
    r = http.expectOne(x => x.url === `${environment.apiUrl}/audit`);
    expect(r.request.params.keys().sort()).toEqual(['page', 'size']);
    expect(r.request.params.get('size')).toBe('50');
    r.flush({ items: [], page: 0, size: 50, hasMore: false });
    http.verify();
  });
});
