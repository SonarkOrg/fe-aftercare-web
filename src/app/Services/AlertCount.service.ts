import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AlertService } from './Alert.service';

/** Number of OPEN alerts, shown as the badge on the sidebar's Alerts link. */
@Injectable({ providedIn: 'root' })
export class AlertCountService {
  readonly openCount$ = new BehaviorSubject<number>(0);

  constructor(private alerts: AlertService) {}

  refresh(): void {
    this.alerts.list(['OPEN']).subscribe({
      next: list => this.openCount$.next(list.length),
      error: () => { /* keep the previous value */ }
    });
  }
}
