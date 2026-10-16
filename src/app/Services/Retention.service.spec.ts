import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { retentionRun, retentionSettings } from '../testing/fixtures';
import { RetentionService } from './Retention.service';

describe('RetentionService', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let svc: RetentionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(RetentionService);
  });
  afterEach(() => http.verify());

  it('reads and saves the settings', () => {
    svc.settings().subscribe();
    let r = http.expectOne(`${api}/settings/retention`);
    expect(r.request.method).toBe('GET');
    r.flush(retentionSettings());
    const body = { closedFollowUpMonths: 24, deletedDocumentMonths: null, messageMonths: 84, notificationMonths: null, auditMonths: null };
    svc.save(body).subscribe();
    r = http.expectOne(`${api}/settings/retention`);
    expect([r.request.method, r.request.body]).toEqual(['PUT', body]);
    r.flush(retentionSettings(body));
  });

  it('runs a dry run (POST, no body content) and lists the runs', () => {
    svc.dryRun().subscribe();
    let r = http.expectOne(`${api}/retention/dry-run`);
    expect(r.request.method).toBe('POST');
    r.flush(retentionRun());
    svc.runs().subscribe();
    r = http.expectOne(`${api}/retention/runs`);
    expect(r.request.method).toBe('GET');
    r.flush([retentionRun()]);
  });
});
