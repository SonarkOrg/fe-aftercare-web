import { HttpBackend, HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, finalize, map, of, shareReplay, take, tap } from 'rxjs';
import { StaffAuth } from './staff-auth';

/** Absolute URL of the local-profile token endpoint. Only provided in the development build. */
export const DEV_TOKEN_URL = new InjectionToken<string>('DEV_TOKEN_URL');

interface DevTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

const REFRESH_MARGIN_MS = 60_000;

@Injectable()
export class DevStaffAuth extends StaffAuth {
  private readonly state = new BehaviorSubject<boolean>(true);
  readonly isAuthenticated$: Observable<boolean> = this.state.asObservable();
  readonly userName$: Observable<string | null> = this.state.pipe(map(a => (a ? 'Dev Nurse' : null)));

  // Bypasses interceptors (and the DI cycle they would create).
  private readonly http: HttpClient;
  private token: string | null = null;
  private expiresAt = 0;
  private inFlight$: Observable<string> | null = null;

  constructor(httpBackend: HttpBackend, private router: Router, @Inject(DEV_TOKEN_URL) private tokenUrl: string) {
    super();
    this.http = new HttpClient(httpBackend);
  }

  login(targetUrl?: string): void {
    this.state.next(true);
    this.router.navigateByUrl(targetUrl ?? '/dashboard');
  }

  logout(): void {
    this.token = null;
    this.expiresAt = 0;
    this.state.next(false);
    this.router.navigateByUrl('/home');
  }

  getAccessToken(): Observable<string> {
    if (this.token && this.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      return of(this.token);
    }
    if (!this.inFlight$) {
      this.inFlight$ = this.http.get<DevTokenResponse>(this.tokenUrl).pipe(
        tap(r => {
          this.token = r.accessToken;
          this.expiresAt = Date.now() + r.expiresIn * 1000;
        }),
        map(r => r.accessToken),
        take(1),
        finalize(() => (this.inFlight$ = null)),
        shareReplay(1)
      );
    }
    return this.inFlight$;
  }
}
