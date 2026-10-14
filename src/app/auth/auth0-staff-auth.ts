import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, map, take } from 'rxjs';
import { StaffAuth } from './staff-auth';

@Injectable()
export class Auth0StaffAuth extends StaffAuth {
  readonly isAuthenticated$: Observable<boolean>;
  readonly userName$: Observable<string | null>;

  constructor(private auth: AuthService) {
    super();
    this.isAuthenticated$ = auth.isAuthenticated$;
    this.userName$ = auth.user$.pipe(map(u => u?.name ?? u?.email ?? null));
  }

  login(targetUrl?: string): void {
    this.auth.loginWithRedirect({ appState: { target: targetUrl ?? '/dashboard' } });
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  getAccessToken(): Observable<string> {
    return this.auth.getAccessTokenSilently().pipe(take(1));
  }
}
