import { HttpBackend, HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, finalize, map, of, shareReplay, take, tap } from 'rxjs';
import { AccessRole } from '../models/me.model';
import { Permissions } from './permissions.service';
import { StaffAuth } from './staff-auth';

/** Absolute URL of the local-profile token endpoint. Only provided in the development build. */
export const DEV_TOKEN_URL = new InjectionToken<string>('DEV_TOKEN_URL');

interface DevTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  sub?: string;
}

/** Which seeded login the dev token is issued for. `{}` = the server default (dev|admin-1). */
export interface DevIdentity { role?: AccessRole; sub?: string }

export const DEV_IDENTITY_KEY = 'aftercare.devIdentity';

const REFRESH_MARGIN_MS = 60_000;

@Injectable()
export class DevStaffAuth extends StaffAuth {
  private readonly state = new BehaviorSubject<boolean>(true);
  private readonly subject = new BehaviorSubject<string | null>(null);
  readonly isAuthenticated$: Observable<boolean> = this.state.asObservable();
  /** The staff name comes from /api/me; there is no hard-coded dev name any more. */
  readonly userName$: Observable<string | null> = of(null);
  readonly subject$: Observable<string | null> = this.subject.asObservable();

  identity: DevIdentity = readIdentity();

  // Bypasses interceptors (and the DI cycle they would create).
  private readonly http: HttpClient;
  private token: string | null = null;
  private expiresAt = 0;
  private inFlight$: Observable<string> | null = null;

  constructor(httpBackend: HttpBackend, private router: Router, private injector: Injector, @Inject(DEV_TOKEN_URL) private tokenUrl: string) {
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

  /** Becomes another seeded login: new token, new permissions, and a full reload so every screen starts clean. */
  switchIdentity(id: DevIdentity): void {
    this.token = null;
    this.expiresAt = 0;
    this.inFlight$ = null;
    this.identity = id;
    this.subject.next(null);
    try {
      sessionStorage.setItem(DEV_IDENTITY_KEY, JSON.stringify(id));
    } catch { /* private window: the switch still works for this page load only */ }
    this.injector.get(Permissions).reset();
    this.reload();
  }

  protected reload(): void {
    window.location.assign('/dashboard');
  }

  private get url(): string {
    const { role, sub } = this.identity;
    if (sub) {
      return `${this.tokenUrl}?sub=${encodeURIComponent(sub)}`;
    }
    return role ? `${this.tokenUrl}?role=${encodeURIComponent(role)}` : this.tokenUrl;
  }

  getAccessToken(): Observable<string> {
    if (this.token && this.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      return of(this.token);
    }
    if (!this.inFlight$) {
      this.inFlight$ = this.http.get<DevTokenResponse>(this.url).pipe(
        tap(r => {
          this.token = r.accessToken;
          this.expiresAt = Date.now() + r.expiresIn * 1000;
          this.subject.next(r.sub ?? null);
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

function readIdentity(): DevIdentity {
  try {
    const raw = sessionStorage.getItem(DEV_IDENTITY_KEY);
    const parsed = raw ? (JSON.parse(raw) as DevIdentity) : null;
    if (parsed && typeof parsed === 'object') {
      return { ...(typeof parsed.role === 'string' ? { role: parsed.role } : {}), ...(typeof parsed.sub === 'string' ? { sub: parsed.sub } : {}) };
    }
  } catch { /* unreadable storage or bad JSON: use the server default */ }
  return {};
}
