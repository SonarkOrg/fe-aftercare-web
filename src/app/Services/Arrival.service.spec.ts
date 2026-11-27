import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { arrivalRow, arrivals } from '../testing/fixtures';
import { ArrivalService } from './Arrival.service';

describe('ArrivalService', () => {
  let service: ArrivalService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ArrivalService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('list GETs /appointments/arrivals with no query when no date is given', () => {
    let got: unknown;
    service.list().subscribe(v => (got = v));
    const req = http.expectOne(`${api}/appointments/arrivals`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(arrivals());
    expect((got as { date: string }).date).toBe('2026-10-14');
  });

  it('list sends the date as a query parameter', () => {
    service.list('2026-10-15').subscribe();
    const req = http.expectOne(r => r.url === `${api}/appointments/arrivals`);
    expect(req.request.params.get('date')).toBe('2026-10-15');
    req.flush(arrivals());
  });

  it('arrive POSTs an empty body to /appointments/{id}/arrival', () => {
    service.arrive(77).subscribe();
    const req = http.expectOne(`${api}/appointments/77/arrival`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(arrivalRow());
  });

  it('undo DELETEs /appointments/{id}/arrival', () => {
    service.undo(77).subscribe();
    const req = http.expectOne(`${api}/appointments/77/arrival`);
    expect(req.request.method).toBe('DELETE');
    req.flush(arrivalRow());
  });
});
