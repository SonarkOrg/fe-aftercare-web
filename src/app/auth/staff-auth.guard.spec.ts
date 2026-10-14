import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { StaffAuth } from './staff-auth';
import { staffAuthGuard } from './staff-auth.guard';

describe('staffAuthGuard', () => {
  function run(authenticated: boolean) {
    const auth = { isAuthenticated$: of(authenticated), login: jasmine.createSpy('login') };
    TestBed.configureTestingModule({ providers: [{ provide: StaffAuth, useValue: auth }] });
    const result = TestBed.runInInjectionContext(() =>
      staffAuthGuard({} as ActivatedRouteSnapshot, { url: '/alerts' } as RouterStateSnapshot)) as Observable<boolean>;
    return { auth, result: firstValueFrom(result) };
  }

  it('allows authenticated users', async () => {
    const { auth, result } = run(true);
    expect(await result).toBeTrue();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('logs in with the requested URL and blocks otherwise', async () => {
    const { auth, result } = run(false);
    expect(await result).toBeFalse();
    expect(auth.login).toHaveBeenCalledWith('/alerts');
  });
});
