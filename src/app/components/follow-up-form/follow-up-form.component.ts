import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FollowUpService } from '../../Services/FollowUp.service';
import { FollowUpWithCode, Specialty } from '../../models/follow-up.model';
import { apiErrorOf } from '../../models/api-error.model';
import { todayLocalIsoDate } from '../../shared/link.util';

@Component({
  selector: 'app-follow-up-form',
  templateUrl: './follow-up-form.component.html'
})
export class FollowUpFormComponent {
  @Input() patientId!: number;
  @Output() created = new EventEmitter<FollowUpWithCode>();

  today = todayLocalIsoDate();
  specialty: Specialty = 'VISCERAL_SURGERY';
  dischargeDate = this.today;
  durationDays = 7;
  saving = false;
  error: string | null = null;
  fieldErrors: Record<string, string> = {};

  constructor(private followUps: FollowUpService) {}

  submit(): void {
    this.saving = true;
    this.error = null;
    this.fieldErrors = {};
    this.followUps.create(this.patientId, {
      specialty: this.specialty,
      dischargeDate: this.dischargeDate,
      durationDays: this.durationDays
    }).subscribe({
      next: res => {
        this.saving = false;
        this.created.emit(res);
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (api?.error === 'FOLLOW_UP_ALREADY_ACTIVE') {
          this.error = 'This patient already has an active follow-up.';
        } else if (api?.error === 'NO_ACTIVE_QUESTIONNAIRE') {
          this.error = 'No active form is configured for this specialty.';
        } else if (api?.error === 'VALIDATION_FAILED') {
          this.fieldErrors = api.fieldErrors;
          this.error = Object.keys(api.fieldErrors).length ? null : 'Please check the form.';
        } else {
          this.error = 'Could not enroll the patient.';
        }
      }
    });
  }
}
