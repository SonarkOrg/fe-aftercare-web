import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClinicSettings, ClinicSettingsRequest } from '../models/settings.model';

/** Clinic settings with a one-request cache: every subscriber shares the latest value; `refresh()` reloads it. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly url = `${environment.apiUrl}/settings/clinic`;
  /** null = fetch from the API; a value = the server just returned it (after a save), use it as is. */
  private readonly reload$ = new ReplaySubject<ClinicSettings | null>(1);

  readonly clinic$: Observable<ClinicSettings> = this.reload$.pipe(
    switchMap(known => (known ? of(known) : this.http.get<ClinicSettings>(this.url))),
    shareReplay(1)
  );

  constructor(private http: HttpClient) {
    this.reload$.next(null);
  }

  refresh(): void {
    this.reload$.next(null);
  }

  update(req: ClinicSettingsRequest): Observable<ClinicSettings> {
    return this.http.put<ClinicSettings>(this.url, req).pipe(tap(saved => this.reload$.next(saved)));
  }
}
