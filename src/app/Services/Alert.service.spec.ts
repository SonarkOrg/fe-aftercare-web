import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AlertService } from './Alert.service';

describe('AlertService', () => {
  let service: AlertService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AlertService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('list() sends no status param by default', () => {
    service.list().subscribe();
    const req = http.expectOne(`${api}/alerts`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([]);
  });

  it('list(statuses) sends one status param per value', () => {
    service.list(['OPEN', 'ACKNOWLEDGED']).subscribe();
    const req = http.expectOne(r => r.url === `${api}/alerts`);
    expect(req.request.params.getAll('status')).toEqual(['OPEN', 'ACKNOWLEDGED']);
    req.flush([]);
  });

  it('listForPatient GETs /patients/:id/alerts', () => {
    service.listForPatient(5).subscribe();
    expect(http.expectOne(`${api}/patients/5/alerts`).request.method).toBe('GET');
  });

  it('acknowledge POSTs {}', () => {
    service.acknowledge(3).subscribe();
    const req = http.expectOne(`${api}/alerts/3/acknowledge`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
  });

  it('resolve POSTs { note }', () => {
    service.resolve(3, 'called patient').subscribe();
    const req = http.expectOne(`${api}/alerts/3/resolve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ note: 'called patient' });
  });
});
