import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { ReportService } from './Report.service';

describe('ReportService', () => {
  it('GETs /reports/summary with from and to', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(ReportService).summary('2026-10-01', '2026-10-15').subscribe();
    const r = http.expectOne(x => x.url === `${environment.apiUrl}/reports/summary`);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('from')).toBe('2026-10-01');
    expect(r.request.params.get('to')).toBe('2026-10-15');
    r.flush({});
    http.verify();
  });
});
