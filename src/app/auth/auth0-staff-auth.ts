import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, map, take } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { StaffAuth } from './staff-auth';

@Injectable()
export class Auth0StaffAuth extends StaffAuth {
  readonly isAuthenticated$: Observable<boolean>;
  readonly userName$: Observable<string | null>;
  readonly subject$: Observable<string | null>;

  constructor(private auth: AuthService, private i18n: I18nService) {
    super();
    this.isAuthenticated$ = auth.isAuthenticated$;
    this.userName$ = auth.user$.pipe(map(u => u?.name ?? u?.email ?? null));
    this.subject$ = auth.user$.pipe(map(u => u?.sub ?? null));
  }

  login(targetUrl?: string): void {
    this.auth.loginWithRedirect({
      appState: { target: targetUrl ?? '/dashboard' },
      authorizationParams: { ui_locales: this.i18n.lang === 'en' ? 'en-CA en' : 'fr-CA fr' }
    });
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  getAccessToken(): Observable<string> {
    return this.auth.getAccessTokenSilently().pipe(take(1));
  }
}
