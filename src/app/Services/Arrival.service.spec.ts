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

  it('walkIn POSTs the body to /appointments/walk-in', () => {
    const body = { patientId: 12, type: 'GENERAL_CONSULT' as const, specialty: 'ORTHOPEDIC_SURGERY' as const, durationMinutes: 30 };
    service.walkIn(body).subscribe();
    const req = http.expectOne(`${api}/appointments/walk-in`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(arrivalRow({ walkIn: true }));
  });

  it('undoWalkIn POSTs an empty body to /appointments/{id}/walk-in/undo and returns the result', () => {
    let got: unknown;
    service.undoWalkIn(90).subscribe(v => (got = v));
    const req = http.expectOne(`${api}/appointments/90/walk-in/undo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ result: 'REMOVED' });
    expect(got).toEqual({ result: 'REMOVED' });
  });

  it('setCardNote PUTs { note } and null clears it', () => {
    service.setCardNote(77, 'NO_CARD').subscribe();
    let req = http.expectOne(`${api}/appointments/77/card-note`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ note: 'NO_CARD' });
    req.flush(arrivalRow());
    service.setCardNote(77, null).subscribe();
    req = http.expectOne(`${api}/appointments/77/card-note`);
    expect(req.request.body).toEqual({ note: null });
    req.flush(arrivalRow());
  });
});
