import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { JANE } from '../testing/fixtures';
import { PatientFileService } from './PatientFile.service';

describe('PatientFileService', () => {
  let http: HttpTestingController;
  let svc: PatientFileService;
  const base = `${environment.apiUrl}/patients/5`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(PatientFileService);
  });
  afterEach(() => http.verify());

  const expectReq = (method: string, url: string, body?: unknown) => {
    const r = http.expectOne(url);
    expect(r.request.method).toBe(method);
    if (body !== undefined) {
      expect(r.request.body).toEqual(body);
    }
    return r;
  };

  it('updatePatient PUTs the full patient', () => {
    svc.updatePatient(5, { ...JANE, dateOfBirth: '1980-05-20' }).subscribe();
    expectReq('PUT', base, { ...JANE, dateOfBirth: '1980-05-20' }).flush(JANE);
  });

  it('medical GETs /medical', () => {
    svc.medical(5).subscribe();
    expectReq('GET', `${base}/medical`).flush({});
  });

  it('health number: set, clear and reveal', () => {
    svc.setHealthNumber(5, 'TREM 6854 1212').subscribe();
    expectReq('PUT', `${base}/health-number`, { healthNumber: 'TREM 6854 1212' }).flush({ healthNumberMasked: 'x' });
    svc.clearHealthNumber(5).subscribe();
    expectReq('DELETE', `${base}/health-number`).flush(null, { status: 204, statusText: 'No Content' });
    svc.revealHealthNumber(5, 'billing check').subscribe();
    expectReq('POST', `${base}/health-number/reveal`, { reason: 'billing check' }).flush({});
  });

  it('generic list items use the list name in the path', () => {
    svc.addItem(5, 'allergies', { substance: 'Latex', severity: 'MILD', reaction: null }).subscribe();
    expectReq('POST', `${base}/allergies`, { substance: 'Latex', severity: 'MILD', reaction: null }).flush({});
    svc.updateItem(5, 'medications', 2, { name: 'X', dose: null, frequency: null, startDate: null }).subscribe();
    expectReq('PUT', `${base}/medications/2`).flush({});
    svc.removeItem(5, 'procedures', 3).subscribe();
    expectReq('DELETE', `${base}/procedures/3`).flush(null, { status: 204, statusText: 'No Content' });
    svc.addItem(5, 'diagnoses', { description: 'd', icd10Code: null, diagnosedOn: null }).subscribe();
    expectReq('POST', `${base}/diagnoses`).flush({});
  });

  it('contacts and care team', () => {
    const req = { name: 'A', relationship: 'B', phone: '514-555-0100', preferredLanguage: 'FR' as const };
    svc.contacts(5).subscribe();
    expectReq('GET', `${base}/emergency-contacts`).flush([]);
    svc.addContact(5, req).subscribe();
    expectReq('POST', `${base}/emergency-contacts`, req).flush({});
    svc.updateContact(5, 7, req).subscribe();
    expectReq('PUT', `${base}/emergency-contacts/7`, req).flush({});
    svc.removeContact(5, 7).subscribe();
    expectReq('DELETE', `${base}/emergency-contacts/7`).flush(null, { status: 204, statusText: 'No Content' });
    svc.careTeam(5).subscribe();
    expectReq('GET', `${base}/care-team`).flush([]);
    svc.assignCareTeam(5, { staffId: 1, role: null }).subscribe();
    expectReq('POST', `${base}/care-team`, { staffId: 1, role: null }).flush({});
    svc.unassignCareTeam(5, 9).subscribe();
    expectReq('DELETE', `${base}/care-team/9`).flush(null, { status: 204, statusText: 'No Content' });
  });
});
