import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { CheckInFeedService } from './CheckInFeed.service';

describe('CheckInFeedService', () => {
  it('GETs /check-ins with from and to', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const http = TestBed.inject(HttpTestingController);
    let result: unknown;
    TestBed.inject(CheckInFeedService).range('2026-09-13', '2026-10-13').subscribe(r => (result = r));
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/check-ins`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-13');
    expect(req.request.params.get('to')).toBe('2026-10-13');
    req.flush([{ id: 1 }]);
    expect(result).toEqual([{ id: 1 }] as any);
    http.verify();
  });
});
