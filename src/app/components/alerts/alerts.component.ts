import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../Services/Alert.service';
import { errorText } from '../../models/api-error.model';
import { Alert, AlertSeverity } from '../../models/alert.model';

export type SeverityFilter = 'all' | AlertSeverity;
export type TypeFilter = 'all' | 'answers' | 'missed';

@Component({
  selector: 'app-alerts',
  templateUrl: './alerts.component.html'
})
export class AlertsComponent implements OnInit {
  alerts: Alert[] = [];
  showResolved = false;
  severity: SeverityFilter = 'all';
  type: TypeFilter = 'all';
  loading = false;
  errorMessage: string | null = null;
  live = '';

  constructor(private alertService: AlertService) {}

  ngOnInit(): void {
    this.load();
  }

  setResolved(resolved: boolean): void {
    if (this.showResolved === resolved) {
      return;
    }
    this.showResolved = resolved;
    this.severity = 'all';
    this.type = 'all';
    this.load();
  }

  setSeverity(s: SeverityFilter): void {
    this.severity = s;
    this.live = `${this.visible.length} alerts shown`;
  }

  setType(t: TypeFilter): void {
    this.type = t;
    this.live = `${this.visible.length} alerts shown`;
  }

  /** Alerts of the chosen type (the severity counts and list work on these). */
  private get ofType(): Alert[] {
    return this.type === 'all' ? this.alerts : this.alerts.filter(a => (this.type === 'missed') === (a.type === 'MISSED_CHECKIN'));
  }

  typeCount(t: TypeFilter): number {
    return t === 'all' ? this.alerts.length : this.alerts.filter(a => (t === 'missed') === (a.type === 'MISSED_CHECKIN')).length;
  }

  count(s: SeverityFilter): number {
    return s === 'all' ? this.ofType.length : this.ofType.filter(a => a.severity === s).length;
  }

  get openCount(): number {
    return this.alerts.filter(a => a.status === 'OPEN').length;
  }

  get ackCount(): number {
    return this.alerts.filter(a => a.status === 'ACKNOWLEDGED').length;
  }

  get visible(): Alert[] {
    return this.severity === 'all' ? this.ofType : this.ofType.filter(a => a.severity === this.severity);
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    const req = this.showResolved ? this.alertService.list(['RESOLVED']) : this.alertService.list();
    req.subscribe({
      next: alerts => {
        this.alerts = alerts;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.alerts = []; // never keep showing a stale list next to the error
        this.errorMessage = errorText(err, 'Could not load alerts.');
      }
    });
  }
}
