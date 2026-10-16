import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { ForbiddenInterceptor } from './forbidden.interceptor';
import { Permissions } from './permissions.service';

describe('ForbiddenInterceptor', () => {
  const api = environment.apiUrl;
  const root = api.replace(/\/api$/, '');
  let http: HttpClient;
  let mock: HttpTestingController;
  let navigate: jasmine.Spy;
  let reset: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: HTTP_INTERCEPTORS, useClass: ForbiddenInterceptor, multi: true }]
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    reset = spyOn(TestBed.inject(Permissions), 'reset');
  });
  afterEach(() => mock.verify());

  const body = (error: string) => ({ status: 403, error, message: 'x', fieldErrors: {} });
  const fail = (url: string, status: number, payload: object | string | null) => {
    let caught: { status: number; error: unknown } | null = null;
    http.get(url).subscribe({ error: e => (caught = e) });
    mock.expectOne(url).flush(payload, { status, statusText: 'err' });
    return caught as { status: number; error: unknown } | null;
  };

  it('NOT_STAFF on a staff call forgets the member, goes to /not-staff and still rethrows', () => {
    const err = fail(`${api}/patients`, 403, body('NOT_STAFF'));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/not-staff');
    expect(err?.status).toBe(403);
    expect((err?.error as { error: string }).error).toBe('NOT_STAFF');
  });

  it('also applies to /api/me itself', () => {
    fail(`${api}/me`, 403, body('NOT_STAFF'));
    expect(navigate).toHaveBeenCalledWith('/not-staff');
  });

  it('does not navigate again when already on /not-staff', () => {
    spyOnProperty(TestBed.inject(Router), 'url').and.returnValue('/not-staff');
    fail(`${api}/me`, 403, body('NOT_STAFF'));
    expect(reset).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('FORBIDDEN passes through unchanged: no reset, no navigation', () => {
    const err = fail(`${api}/audit`, 403, body('FORBIDDEN'));
    expect(reset).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect((err?.error as { error: string }).error).toBe('FORBIDDEN');
  });

  it('other errors and 403s without an ApiError body are left alone', () => {
    fail(`${api}/patients`, 500, null);
    fail(`${api}/patients`, 403, 'plain text');
    fail(`${api}/patients`, 401, null);
    expect(reset).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never touches non-staff URLs, /public included', () => {
    fail(`${api}/public/q/abc`, 403, body('NOT_STAFF'));
    fail(`${root}/dev/token`, 403, body('NOT_STAFF'));
    fail('https://example.com/other', 403, body('NOT_STAFF'));
    expect(reset).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes successful responses through', () => {
    let got: unknown;
    http.get(`${api}/patients`).subscribe(r => (got = r));
    mock.expectOne(`${api}/patients`).flush([{ id: 1 }]);
    expect(got).toEqual([{ id: 1 }]);
  });
});
