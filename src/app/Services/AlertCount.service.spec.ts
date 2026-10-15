import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { CLINIC, alertDto } from '../testing/fixtures';
import { AlertCountService } from './AlertCount.service';

describe('AlertCountService', () => {
  let http: HttpTestingController;
  let svc: AlertCountService;
  const api = environment.apiUrl;
  const req = () => http.expectOne(r => r.url === `${api}/alerts`);
  const settings = (body: object = CLINIC) => http.expectOne(`${api}/settings/clinic`).flush(body);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(AlertCountService);
  });
  afterEach(() => http.verify());

  it('starts at 0 and emits the number of OPEN alerts', () => {
    expect(svc.openCount$.value).toBe(0);
    svc.refresh();
    settings();
    const r = req();
    expect(r.request.params.getAll('status')).toEqual(['OPEN']);
    r.flush([alertDto(), alertDto({ id: 2 }), alertDto({ id: 3, severity: 'MEDIUM' })]);
    expect(svc.openCount$.value).toBe(3);
  });

  it('keeps the previous value on error', () => {
    svc.refresh();
    settings();
    req().flush([alertDto()]);
    svc.refresh(); // settings are cached: no second settings request
    req().flush('x', { status: 500, statusText: 'Server Error' });
    expect(svc.openCount$.value).toBe(1);
  });

  it('excludes MEDIUM alerts when only HIGH is notified', () => {
    svc.refresh();
    settings({ ...CLINIC, notifySeverities: ['HIGH'] });
    req().flush([alertDto(), alertDto({ id: 2, severity: 'MEDIUM' }), alertDto({ id: 3, severity: 'MEDIUM' })]);
    expect(svc.openCount$.value).toBe(1);
  });

  it('counts nothing when no severity is notified', () => {
    svc.refresh();
    settings({ ...CLINIC, notifySeverities: [] });
    req().flush([alertDto(), alertDto({ id: 2, severity: 'MEDIUM' })]);
    expect(svc.openCount$.value).toBe(0);
  });

  it('falls back to counting every OPEN alert when the settings fail to load', () => {
    svc.refresh();
    http.expectOne(`${api}/settings/clinic`).flush('x', { status: 500, statusText: 'Server Error' });
    req().flush([alertDto(), alertDto({ id: 2, severity: 'MEDIUM' })]);
    expect(svc.openCount$.value).toBe(2);
  });
});
