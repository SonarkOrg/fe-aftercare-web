import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { DEV_TOKEN_URL, DevStaffAuth } from './dev-staff-auth';
import { StaffAuth } from './staff-auth';
import { StaffAuthInterceptor } from './staff-auth.interceptor';

describe('DevStaffAuth', () => {
  const url = 'http://localhost:8080/dev/token';
  let auth: DevStaffAuth;
  let httpMock: HttpTestingController;
  let router: Router;
  let spyAuth: jasmine.Spy;

  beforeEach(() => {
    spyAuth = jasmine.createSpy('getAccessToken').and.callFake(() => { throw new Error('interceptor must not ask for a token'); });
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        DevStaffAuth, { provide: DEV_TOKEN_URL, useValue: url },
        { provide: StaffAuth, useValue: { getAccessToken: spyAuth } },
        { provide: HTTP_INTERCEPTORS, useClass: StaffAuthInterceptor, multi: true }
      ]
    });
    auth = TestBed.inject(DevStaffAuth);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    httpMock.verify();
  });

  const tokenBody = (t: string) => ({ accessToken: t, tokenType: 'Bearer', expiresIn: 28800 });

  it('GETs the token URL once, without an Authorization header, and dedupes concurrent callers', async () => {
    const a = firstValueFrom(auth.getAccessToken());
    const b = firstValueFrom(auth.getAccessToken());
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(spyAuth).not.toHaveBeenCalled();
    req.flush(tokenBody('t1'));
    expect(await a).toBe('t1');
    expect(await b).toBe('t1');
  });

  it('serves the cached token while more than 60s remain', async () => {
    const first = firstValueFrom(auth.getAccessToken());
    httpMock.expectOne(url).flush(tokenBody('t1'));
    await first;
    expect(await firstValueFrom(auth.getAccessToken())).toBe('t1');
    httpMock.expectNone(url);
  });

  it('refreshes when within 60s of expiry', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 14, 8, 0, 0));
    const first = firstValueFrom(auth.getAccessToken());
    httpMock.expectOne(url).flush(tokenBody('t1'));
    await first;

    jasmine.clock().mockDate(new Date(2026, 9, 14, 8, 0, 0, 28800 * 1000 - 61_000));
    expect(await firstValueFrom(auth.getAccessToken())).toBe('t1');
    httpMock.expectNone(url);

    jasmine.clock().mockDate(new Date(2026, 9, 14, 8, 0, 0, 28800 * 1000 - 59_000));
    const second = firstValueFrom(auth.getAccessToken());
    httpMock.expectOne(url).flush(tokenBody('t2'));
    expect(await second).toBe('t2');
  });

  it('reports an authenticated "Dev Nurse" until logout', async () => {
    expect(await firstValueFrom(auth.isAuthenticated$)).toBeTrue();
    expect(await firstValueFrom(auth.userName$)).toBe('Dev Nurse');
  });

  it('logout clears the token, sets state false and navigates to /home', async () => {
    const nav = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const first = firstValueFrom(auth.getAccessToken());
    httpMock.expectOne(url).flush(tokenBody('t1'));
    await first;

    auth.logout();
    expect(await firstValueFrom(auth.isAuthenticated$)).toBeFalse();
    expect(await firstValueFrom(auth.userName$)).toBeNull();
    expect(nav).toHaveBeenCalledWith('/home');

    const again = firstValueFrom(auth.getAccessToken());
    httpMock.expectOne(url).flush(tokenBody('t3'));
    expect(await again).toBe('t3');
  });

  it('login sets state true and navigates to the target (default /dashboard)', async () => {
    const nav = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    auth.logout();
    auth.login('/alerts');
    expect(nav).toHaveBeenCalledWith('/alerts');
    auth.login();
    expect(nav).toHaveBeenCalledWith('/dashboard');
    expect(await firstValueFrom(auth.isAuthenticated$)).toBeTrue();
  });
});
