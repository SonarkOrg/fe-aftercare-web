import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PatientService } from './Patient.service';
import { Patient } from '../models/patient.model';
import { environment } from '../../environments/environment';

describe('PatientService', () => {
  let service: PatientService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/patients`;
  const patient: Patient = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '5551234567',
    gender: 'female',
    address: { city: 'Austin', state: 'TX', zip: '73301' }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PatientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('addPatient should POST to /patients/register', () => {
    service.addPatient(patient).subscribe(p => expect(p.id).toBe(1));
    const req = httpMock.expectOne(`${base}/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(patient);
    req.flush({ ...patient, id: 1 });
  });

  it('getPatientList should GET /patients', () => {
    service.getPatientList().subscribe(list => expect(list.length).toBe(1));
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([patient]);
  });

  it('getPatient should GET /patients/:id', () => {
    service.getPatient(5).subscribe(p => expect(p.firstName).toBe('Jane'));
    const req = httpMock.expectOne(`${base}/5`);
    expect(req.request.method).toBe('GET');
    req.flush(patient);
  });

  it('deletePatient should DELETE /patients/:id', () => {
    service.deletePatient(5).subscribe();
    const req = httpMock.expectOne(`${base}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
