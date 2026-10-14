import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AppointmentService } from './Appointment.service';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AppointmentService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('list GETs /appointments with from, to and repeated status', () => {
    service.list('2026-10-12', '2026-10-18', ['SCHEDULED', 'READY']).subscribe();
    const req = http.expectOne(r => r.url === `${api}/appointments`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-10-12');
    expect(req.request.params.get('to')).toBe('2026-10-18');
    expect(req.request.params.getAll('status')).toEqual(['SCHEDULED', 'READY']);
  });

  it('list without statuses sends only from and to', () => {
    service.list('2026-10-14', '2026-10-14').subscribe();
    const req = http.expectOne(r => r.url === `${api}/appointments`);
    expect(req.request.params.keys().sort()).toEqual(['from', 'to']);
  });

  it('metrics GETs /appointments/metrics', () => {
    service.metrics('2026-10-14', '2026-10-14').subscribe();
    const req = http.expectOne(r => r.url === `${api}/appointments/metrics`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-10-14');
    expect(req.request.params.get('to')).toBe('2026-10-14');
  });

  it('get GETs /appointments/:id', () => {
    service.get(4).subscribe();
    expect(http.expectOne(`${api}/appointments/4`).request.method).toBe('GET');
  });

  it('create POSTs the request body', () => {
    const body = { patientId: 5, type: 'SURGERY' as const, specialty: 'ORTHOPEDIC_SURGERY' as const,
      scheduledAt: '2026-10-16T08:00:00', durationMinutes: 60, location: null, clinician: null };
    service.create(body).subscribe();
    const req = http.expectOne(`${api}/appointments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
  });

  it('update PUTs to /appointments/:id', () => {
    const body = { type: 'SURGERY' as const, specialty: 'ORTHOPEDIC_SURGERY' as const,
      scheduledAt: '2026-10-16T08:00:00', durationMinutes: 60 };
    service.update(4, body).subscribe();
    const req = http.expectOne(`${api}/appointments/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
  });

  it('delete DELETEs /appointments/:id', () => {
    service.delete(4).subscribe();
    expect(http.expectOne(`${api}/appointments/4`).request.method).toBe('DELETE');
  });

  it('regenerateCode, markReviewed POST {} to their paths', () => {
    service.regenerateCode(4).subscribe();
    const a = http.expectOne(`${api}/appointments/4/access-code`);
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual({});
    service.markReviewed(4).subscribe();
    const b = http.expectOne(`${api}/appointments/4/review`);
    expect(b.request.method).toBe('POST');
    expect(b.request.body).toEqual({});
  });

  it('setStatus POSTs { status }', () => {
    service.setStatus(4, 'NO_SHOW').subscribe();
    const req = http.expectOne(`${api}/appointments/4/status`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ status: 'NO_SHOW' });
  });

  it('listForPatient GETs /patients/:id/appointments', () => {
    service.listForPatient(5).subscribe();
    expect(http.expectOne(`${api}/patients/5/appointments`).request.method).toBe('GET');
  });
});
