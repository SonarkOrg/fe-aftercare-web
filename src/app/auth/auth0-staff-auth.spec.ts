import { TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { Auth0StaffAuth } from './auth0-staff-auth';

describe('Auth0StaffAuth', () => {
  let stub: any;
  let user$: BehaviorSubject<any>;
  let auth: Auth0StaffAuth;

  beforeEach(() => {
    user$ = new BehaviorSubject<any>({ name: 'Nurse N', email: 'n@example.com' });
    stub = {
      isAuthenticated$: of(true),
      user$,
      loginWithRedirect: jasmine.createSpy('loginWithRedirect'),
      logout: jasmine.createSpy('logout'),
      getAccessTokenSilently: jasmine.createSpy('getAccessTokenSilently').and.returnValue(of('a', 'b'))
    };
    TestBed.configureTestingModule({ providers: [Auth0StaffAuth, { provide: AuthService, useValue: stub }] });
    auth = TestBed.inject(Auth0StaffAuth);
  });

  it('delegates isAuthenticated$', async () => {
    expect(await firstValueFrom(auth.isAuthenticated$)).toBeTrue();
  });

  it('maps userName$ to name, then email, then null', async () => {
    expect(await firstValueFrom(auth.userName$)).toBe('Nurse N');
    user$.next({ email: 'n@example.com' });
    expect(await firstValueFrom(auth.userName$)).toBe('n@example.com');
    user$.next(null);
    expect(await firstValueFrom(auth.userName$)).toBeNull();
  });

  it('login passes the target in appState (default /dashboard)', () => {
    auth.login('/alerts');
    expect(stub.loginWithRedirect).toHaveBeenCalledWith({ appState: { target: '/alerts' } });
    auth.login();
    expect(stub.loginWithRedirect).toHaveBeenCalledWith({ appState: { target: '/dashboard' } });
  });

  it('logout returns to the origin', () => {
    auth.logout();
    expect(stub.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
  });

  it('getAccessToken emits once', async () => {
    const values: string[] = [];
    await new Promise<void>(resolve => auth.getAccessToken().subscribe({ next: v => values.push(v), complete: resolve }));
    expect(values).toEqual(['a']);
  });
});
