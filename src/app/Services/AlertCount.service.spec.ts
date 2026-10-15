import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { alertDto } from '../testing/fixtures';
import { AlertCountService } from './AlertCount.service';

describe('AlertCountService', () => {
  let http: HttpTestingController;
  let svc: AlertCountService;
  const req = () => http.expectOne(r => r.url === `${environment.apiUrl}/alerts`);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(AlertCountService);
  });
  afterEach(() => http.verify());

  it('starts at 0 and emits the number of OPEN alerts', () => {
    expect(svc.openCount$.value).toBe(0);
    svc.refresh();
    const r = req();
    expect(r.request.params.getAll('status')).toEqual(['OPEN']);
    r.flush([alertDto(), alertDto({ id: 2 }), alertDto({ id: 3 })]);
    expect(svc.openCount$.value).toBe(3);
  });

  it('keeps the previous value on error', () => {
    svc.refresh();
    req().flush([alertDto()]);
    svc.refresh();
    req().flush('x', { status: 500, statusText: 'Server Error' });
    expect(svc.openCount$.value).toBe(1);
  });
});
