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
});
