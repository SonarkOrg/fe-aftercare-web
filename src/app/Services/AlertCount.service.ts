import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, of, take } from 'rxjs';
import { AlertSeverity } from '../models/alert.model';
import { Permissions } from '../auth/permissions.service';
import { AlertService } from './Alert.service';
import { SettingsService } from './Settings.service';

/**
 * Number of OPEN alerts that count toward the top-bar badge: only the severities the clinic chose to be
 * notified about (Settings). If the settings cannot be loaded, every OPEN alert counts.
 */
@Injectable({ providedIn: 'root' })
export class AlertCountService {
  readonly openCount$ = new BehaviorSubject<number>(0);

  constructor(private alerts: AlertService, private settings: SettingsService, private permissions: Permissions) {}

  /** Does nothing (no request) without CLINICAL_READ. */
  refresh(): void {
    if (!this.permissions.can('CLINICAL_READ')) {
      this.openCount$.next(0);
      return;
    }
    this.settings.clinic$.pipe(take(1), catchError(() => of(null))).subscribe(clinic => {
      const wanted: AlertSeverity[] | null = clinic ? clinic.notifySeverities : null;
      this.alerts.list(['OPEN']).subscribe({
        next: list => this.openCount$.next(wanted ? list.filter(a => wanted.includes(a.severity)).length : list.length),
        error: () => { /* keep the previous value */ }
      });
    });
  }
}
