import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { AppointmentService } from '../../../Services/Appointment.service';
import { Permissions } from '../../../auth/permissions.service';
import { PatientDeskService } from '../../../Services/PatientDesk.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { ArrivalRow } from '../../../models/arrival.model';
import { ContactConsent } from '../../../models/notification.model';

/** Expanded part of a row: fixes the usual blockers (consent, questionnaire link) without leaving the screen. */
@Component({
  selector: 'app-fix-panel',
  templateUrl: './fix-panel.component.html'
})
export class FixPanelComponent implements OnChanges {
  @Input() row!: ArrivalRow;
  @Input() readOnly = false;
  /** Emitted once the consent answer is saved, so the page can update the row and give the focus back to the box. */
  @Output() consentSaved = new EventEmitter<'GRANTED' | 'WITHDRAWN'>();

  consent: ContactConsent = 'UNKNOWN';
  busy = false;
  error: string | null = null;
  /** The freshly created link code: lives in this component only (never logged or stored) and leaves with the panel. */
  code: string | null = null;

  constructor(private desk: PatientDeskService, private appointments: AppointmentService, private errors: ApiErrorsService,
              private permissions: Permissions) {}

  ngOnChanges(): void {
    this.consent = this.row.patient.contactConsent;
  }

  get questionnaireMissing(): boolean {
    return this.row.desk.reasons.includes('QUESTIONNAIRE_MISSING');
  }

  get contactMissing(): boolean {
    return this.row.patient.contactMissing;
  }

  get dobMissing(): boolean {
    return this.row.desk.reasons.includes('DOB_MISSING');
  }

  /** The consent question is shown when the answer is unknown and there is a contact to message (spec 7.5). */
  get askConsent(): boolean {
    return this.consent === 'UNKNOWN' && !this.contactMissing;
  }

  /**
   * A link code is a read grant on the patient's whole message thread, so its plaintext is never shown to a role without
   * CLINICAL_READ (EFVP rule A-44, which overrides spec 7.5): the desk uses « Envoyer le lien » instead.
   */
  get clinical(): boolean {
    return this.permissions.can('CLINICAL_READ');
  }

  get canNewLink(): boolean {
    return this.clinical && this.row.linkUsable && this.row.status === 'SCHEDULED';
  }

  answer(value: 'GRANTED' | 'WITHDRAWN'): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    this.desk.setConsent(this.row.patient.id, value).subscribe({
      next: () => {
        this.busy = false;
        this.consent = value;
        this.consentSaved.emit(value);
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'fd.error.consent');
      }
    });
  }

  newLink(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    this.appointments.regenerateCode(this.row.appointmentId).subscribe({
      next: res => {
        this.busy = false;
        this.code = res.accessCode;
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'fd.error.link');
      }
    });
  }
}
