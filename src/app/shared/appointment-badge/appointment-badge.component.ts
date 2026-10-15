import { Component, Input } from '@angular/core';
import { AppointmentStatus } from '../../models/appointment.model';
import { appointmentChip } from '../status';

@Component({
  selector: 'app-appointment-badge',
  template: `<app-status-chip [spec]="chip" [size]="size"></app-status-chip>`
})
export class AppointmentBadgeComponent {
  @Input() appointment!: { status: AppointmentStatus; questionnaireMissing: boolean };
  @Input() size: 'sm' | 'md' = 'md';

  get chip() {
    return appointmentChip(this.appointment);
  }
}
