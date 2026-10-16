import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AlertCountService } from '../../Services/AlertCount.service';
import { AlertService } from '../../Services/Alert.service';
import { Alert } from '../../models/alert.model';
import { ApiErrorsService } from '../../i18n/api-errors';
import { alertMessage, alertQuestion } from '../../i18n/content';
import { I18nService } from '../../i18n/i18n.service';
import { alertAnswer, alertDay, isMissed } from '../../shared/alert.util';
import { initials } from '../../shared/link.util';
import { alertStatusChip, severityChip } from '../../shared/status';

@Component({
  selector: 'app-alert-table',
  templateUrl: './alert-table.component.html'
})
export class AlertTableComponent {
  @Input() alerts: Alert[] = [];
  @Input() showPatient = false;
  @Output() changed = new EventEmitter<void>();

  resolvingId: number | null = null;
  note = '';
  busy = false;
  message: string | null = null;

  severityChip = severityChip;
  statusChip = alertStatusChip;
  initialsOf = initials;
  alertDay = alertDay;
  isMissed = isMissed;

  constructor(private alertService: AlertService, private alertCount: AlertCountService, public i18n: I18nService, private errors: ApiErrorsService) {}

  question(a: Alert) {
    return alertQuestion(a, this.i18n.lang, k => this.i18n.t(k));
  }

  answer(a: Alert): string {
    return alertAnswer(a, this.i18n.lang, k => this.i18n.t(k));
  }

  message$(a: Alert): string {
    return alertMessage(a, this.i18n.lang);
  }

  startResolve(a: Alert): void {
    this.resolvingId = a.id;
    this.note = '';
  }

  cancelResolve(): void {
    this.resolvingId = null;
  }

  acknowledge(a: Alert): void {
    this.run(this.alertService.acknowledge(a.id));
  }

  confirmResolve(a: Alert): void {
    if (!this.note.trim()) {
      return;
    }
    this.run(this.alertService.resolve(a.id, this.note.trim()));
  }

  private run(obs: ReturnType<AlertService['acknowledge']>): void {
    this.busy = true;
    this.message = null;
    obs.subscribe({
      next: () => {
        this.busy = false;
        this.resolvingId = null;
        this.alertCount.refresh();
        this.changed.emit();
      },
      error: err => {
        this.busy = false;
        if (err?.status === 409) {
          this.message = this.i18n.t('dashboard.error.alertConflict');
          this.resolvingId = null;
          this.changed.emit();
        } else {
          this.message = this.errors.text(err, 'alerts.error.update', { INVALID_STATE: 'alerts.error.alreadyResolved' });
        }
      }
    });
  }
}
