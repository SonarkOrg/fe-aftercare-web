import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, finalize, map, of, shareReplay, tap } from 'rxjs';
import { MeService } from '../Services/Me.service';
import { AccessRole, Me, Permission } from '../models/me.model';

/**
 * The signed-in staff member and what they may do. The backend is the only place that knows the role-to-permission
 * matrix; the UI checks permissions, never roles. Hiding things here is a convenience: the API enforces everything.
 */
@Injectable({ providedIn: 'root' })
export class Permissions {
  private readonly current = new BehaviorSubject<Me | null>(null);
  private inFlight$: Observable<Me> | null = null;

  readonly me$: Observable<Me | null> = this.current.asObservable();

  constructor(private meService: MeService) {}

  get me(): Me | null {
    return this.current.value;
  }

  get role(): AccessRole | null {
    return this.current.value?.accessRole ?? null;
  }

  /** Cached after the first success; concurrent callers share one request. Errors propagate (and are not cached). */
  load(force = false): Observable<Me> {
    const known = this.current.value;
    if (known && !force) {
      return of(known);
    }
    if (!this.inFlight$) {
      this.inFlight$ = this.meService.load().pipe(
        tap(me => this.current.next(me)),
        finalize(() => (this.inFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.inFlight$;
  }

  can(p: Permission): boolean {
    return !!this.current.value?.permissions.includes(p);
  }

  canAny(...ps: Permission[]): boolean {
    return ps.some(p => this.can(p));
  }

  can$(p: Permission): Observable<boolean> {
    return this.current.pipe(map(me => !!me?.permissions.includes(p)), distinctUntilChanged());
  }

  /** Forget the signed-in member (logout, identity switch, NOT_STAFF). */
  reset(): void {
    this.inFlight$ = null;
    this.current.next(null);
  }

  /** Sets the current member without a request (tests and the dev identity switch). */
  seed(me: Me | null): void {
    this.current.next(me);
  }
}
