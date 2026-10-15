import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { PublicMessageService } from '../Services/PublicMessage.service';
import { StaffAuth } from './staff-auth';
import { StaffAuthInterceptor } from './staff-auth.interceptor';

describe('StaffAuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let getAccessToken: jasmine.Spy;
  const api = environment.apiUrl;

  beforeEach(() => {
    getAccessToken = jasmine.createSpy('getAccessToken').and.returnValue(of('tok-123'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: StaffAuth, useValue: { getAccessToken } },
        { provide: HTTP_INTERCEPTORS, useClass: StaffAuthInterceptor, multi: true }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the bearer token to staff URLs', () => {
    http.get(`${api}/patients/5`).subscribe();
    const req = httpMock.expectOne(`${api}/patients/5`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    req.flush({});
  });

  it('attaches the token to staff URLs with a query string', () => {
    http.get(`${api}/alerts`, { params: { status: 'OPEN' } }).subscribe();
    const req = httpMock.expectOne(r => r.url === `${api}/alerts`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    req.flush([]);
  });

  it('never touches public URLs', () => {
    http.get(`${api}/public/q/abc`).subscribe();
    const req = httpMock.expectOne(`${api}/public/q/abc`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(getAccessToken).not.toHaveBeenCalled();
    req.flush({});
  });

  it('never touches dev URLs', () => {
    const url = api.replace(/\/api$/, '') + '/dev/token';
    http.get(url).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(getAccessToken).not.toHaveBeenCalled();
    req.flush({});
  });

  it('propagates HTTP errors', () => {
    let status = 0;
    http.get(`${api}/patients`).subscribe({ error: e => (status = e.status) });
    httpMock.expectOne(`${api}/patients`).flush('no', { status: 500, statusText: 'Server Error' });
    expect(status).toBe(500);
  });

  it('propagates token errors without sending the request', () => {
    getAccessToken.and.returnValue(throwError(() => new Error('login required')));
    let message = '';
    http.get(`${api}/patients`).subscribe({ error: e => (message = e.message) });
    httpMock.expectNone(`${api}/patients`);
    expect(message).toBe('login required');
  });

  it('never attaches the staff token to the public message endpoints', () => {
    const svc = TestBed.inject(PublicMessageService);
    svc.thread('abc').subscribe();
    svc.thread('abc', 9).subscribe();
    svc.send('abc', 'hello').subscribe();
    svc.markRead('abc', 3).subscribe();
    const reqs = httpMock.match(r => r.url.startsWith(`${api}/public/q/abc/messages`));
    expect(reqs.length).toBe(4);
    for (const r of reqs) {
      expect(r.request.headers.has('Authorization')).withContext(r.request.method + ' ' + r.request.url).toBeFalse();
      r.flush({});
    }
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('attaches the token to the staff message inbox', () => {
    http.get(`${api}/messages/inbox`).subscribe();
    const req = httpMock.expectOne(`${api}/messages/inbox`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    req.flush([]);
  });
});
