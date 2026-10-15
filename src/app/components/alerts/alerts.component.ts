import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../Services/Alert.service';
import { Alert, AlertSeverity } from '../../models/alert.model';

export type SeverityFilter = 'all' | AlertSeverity;

@Component({
  selector: 'app-alerts',
  templateUrl: './alerts.component.html'
})
export class AlertsComponent implements OnInit {
  alerts: Alert[] = [];
  showResolved = false;
  severity: SeverityFilter = 'all';
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
    this.load();
  }

  setSeverity(s: SeverityFilter): void {
    this.severity = s;
    this.live = `${this.visible.length} alerts shown`;
  }

  count(s: SeverityFilter): number {
    return s === 'all' ? this.alerts.length : this.alerts.filter(a => a.severity === s).length;
  }

  get openCount(): number {
    return this.alerts.filter(a => a.status === 'OPEN').length;
  }

  get ackCount(): number {
    return this.alerts.filter(a => a.status === 'ACKNOWLEDGED').length;
  }

  get visible(): Alert[] {
    return this.severity === 'all' ? this.alerts : this.alerts.filter(a => a.severity === this.severity);
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
      error: () => {
        this.loading = false;
        this.alerts = []; // never keep showing a stale list next to the error
        this.errorMessage = 'Could not load alerts.';
      }
    });
  }
}
