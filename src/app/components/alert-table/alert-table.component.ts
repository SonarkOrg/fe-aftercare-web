import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AlertService } from '../../Services/Alert.service';
import { Alert } from '../../models/alert.model';

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

  constructor(private alertService: AlertService) {}

  display(a: Alert): string {
    if (a.answerValue === 'true') {
      return 'Yes';
    }
    return a.answerValue === 'false' ? 'No' : a.answerValue;
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
        this.changed.emit();
      },
      error: err => {
        this.busy = false;
        if (err?.status === 409) {
          this.message = 'This alert was updated by someone else. Reloading.';
          this.resolvingId = null;
          this.changed.emit();
        } else {
          this.message = 'Could not update the alert.';
        }
      }
    });
  }
}
