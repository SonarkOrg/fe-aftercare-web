import { Component, Input } from '@angular/core';
import { AppointmentStatus } from '../../models/appointment.model';
import { appointmentChip, arrivalChip } from '../status';

@Component({
  selector: 'app-appointment-badge',
  template: `<app-status-chip [spec]="chip" [size]="size"></app-status-chip><app-status-chip *ngIf="arrival as c" class="arrival-chip" [spec]="c" [size]="size"></app-status-chip>`
})
export class AppointmentBadgeComponent {
  @Input() appointment!: { status: AppointmentStatus; questionnaireMissing: boolean; arrivedAt?: string | null };
  @Input() size: 'sm' | 'md' = 'md';

  get chip() {
    return appointmentChip(this.appointment);
  }

  /** A second small chip once the patient is at the clinic; the status chip itself is untouched. */
  get arrival() {
    return arrivalChip({ arrivedAt: this.appointment.arrivedAt ?? null, status: this.appointment.status });
  }
}
