import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FollowUpService } from '../../Services/FollowUp.service';
import { FollowUpWithCode, Specialty } from '../../models/follow-up.model';
import { ApiErrorsService } from '../../i18n/api-errors';
import { I18nService } from '../../i18n/i18n.service';
import { apiErrorOf } from '../../models/api-error.model';
import { businessToday } from '../../shared/link.util';

@Component({
  selector: 'app-follow-up-form',
  templateUrl: './follow-up-form.component.html'
})
export class FollowUpFormComponent {
  @Input() patientId!: number;
  @Output() created = new EventEmitter<FollowUpWithCode>();

  today = businessToday();
  specialty: Specialty = 'VISCERAL_SURGERY';
  dischargeDate = this.today;
  durationDays = 7;
  saving = false;
  error: string | null = null;
  fieldErrors: Record<string, string> = {};

  constructor(private followUps: FollowUpService, private errors: ApiErrorsService, private i18n: I18nService) {}

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
        if (api?.error === 'VALIDATION_FAILED') {
          this.fieldErrors = this.errors.fieldTexts(err);
          this.error = Object.keys(api.fieldErrors).length ? null : this.i18n.t('error.code.VALIDATION_FAILED');
        } else {
          this.error = this.errors.text(err, 'followUp.error.enroll', { NO_ACTIVE_QUESTIONNAIRE: 'error.msg.noQSpecialty' });
        }
      }
    });
  }
}
