import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../Services/Alert.service';
import { Alert } from '../../models/alert.model';

@Component({
  selector: 'app-alerts',
  templateUrl: './alerts.component.html'
})
export class AlertsComponent implements OnInit {
  alerts: Alert[] = [];
  showResolved = false;
  loading = false;
  errorMessage: string | null = null;

  constructor(private alertService: AlertService) {}

  ngOnInit(): void {
    this.load();
  }

  toggleResolved(checked: boolean): void {
    this.showResolved = checked;
    this.load();
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
        this.errorMessage = 'Could not load alerts.';
      }
    });
  }
}
