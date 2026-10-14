import { Observable } from 'rxjs';

/** Staff authentication, independent of the provider (Auth0 in production, a local dev token otherwise). */
export abstract class StaffAuth {
  abstract readonly isAuthenticated$: Observable<boolean>;
  abstract readonly userName$: Observable<string | null>;
  /** Default target is '/dashboard'. */
  abstract login(targetUrl?: string): void;
  abstract logout(): void;
  /** Emits once and completes. */
  abstract getAccessToken(): Observable<string>;
}
