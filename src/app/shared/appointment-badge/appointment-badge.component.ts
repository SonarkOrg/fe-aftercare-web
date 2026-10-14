import { Component, Input } from '@angular/core';
import { AppointmentStatus } from '../../models/appointment.model';

@Component({
  selector: 'app-appointment-badge',
  template: `<span class="badge" [ngClass]="cls">{{ label }}</span>`
})
export class AppointmentBadgeComponent {
  @Input() appointment!: { status: AppointmentStatus; questionnaireMissing: boolean };

  get label(): string {
    return this.pick()[0];
  }

  get cls(): string {
    return this.pick()[1];
  }

  private pick(): [string, string] {
    const a = this.appointment;
    switch (a.status) {
      case 'CANCELLED': return ['Cancelled', 'badge-muted'];
      case 'COMPLETED': return ['Completed', 'badge-muted'];
      case 'NO_SHOW': return ['No-show', 'badge-muted'];
      case 'NEEDS_REVIEW': return ['Needs review', 'badge-warn'];
      case 'READY': return ['Ready', 'badge-ok'];
      default:
        return a.questionnaireMissing ? ['Questionnaire missing', 'badge-alert'] : ['Awaiting questionnaire', 'badge-info'];
    }
  }
}
