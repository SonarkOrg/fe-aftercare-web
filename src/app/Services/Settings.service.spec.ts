import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { CLINIC } from '../testing/fixtures';
import { SettingsService } from './Settings.service';

describe('SettingsService', () => {
  let http: HttpTestingController;
  let svc: SettingsService;
  const url = `${environment.apiUrl}/settings/clinic`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(SettingsService);
  });
  afterEach(() => http.verify());

  it('makes no request until somebody subscribes, then one request for any number of subscribers', () => {
    http.expectNone(url);
    const a: string[] = [];
    const b: string[] = [];
    svc.clinic$.subscribe(c => a.push(c.name));
    svc.clinic$.subscribe(c => b.push(c.name));
    http.expectOne(url).flush(CLINIC);
    expect(a).toEqual(['Clinique Test']);
    expect(b).toEqual(['Clinique Test']);
    svc.clinic$.subscribe(c => a.push(c.name)); // late subscriber: cached
    http.expectNone(url);
    expect(a.length).toBe(2);
  });

  it('refresh() reloads and every subscriber sees the new value', () => {
    const names: string[] = [];
    svc.clinic$.subscribe(c => names.push(c.name));
    http.expectOne(url).flush(CLINIC);
    svc.refresh();
    http.expectOne(url).flush({ ...CLINIC, name: 'Other' });
    expect(names).toEqual(['Clinique Test', 'Other']);
  });

  it('update() PUTs the body and refreshes the cache with the saved settings', () => {
    const names: string[] = [];
    svc.clinic$.subscribe(c => names.push(c.name));
    http.expectOne(url).flush(CLINIC);
    const body = { name: 'New', addressLine: null, city: null, province: 'QC', postalCode: null, phone: null, defaultLanguage: 'EN' as const, notifySeverities: ['HIGH' as const] };
    let saved = '';
    svc.update(body).subscribe(s => (saved = s.name));
    const r = http.expectOne(url);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual(body);
    r.flush({ ...CLINIC, ...body });
    expect(saved).toBe('New');
    expect(names).toEqual(['Clinique Test', 'New']);
    http.expectNone(url); // the saved value is used: no extra GET
  });

  it('a failed load can be retried by the next subscriber', () => {
    let failed = false;
    svc.clinic$.subscribe({ error: () => (failed = true) });
    http.expectOne(url).flush('x', { status: 500, statusText: 'Server Error' });
    expect(failed).toBeTrue();
    let name = '';
    svc.clinic$.subscribe(c => (name = c.name));
    http.expectOne(url).flush(CLINIC);
    expect(name).toBe('Clinique Test');
  });
});
