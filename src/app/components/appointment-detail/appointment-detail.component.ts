import { NotificationService } from '../../Services/Notification.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from '../../Services/Appointment.service';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { FhirQuestionnaire } from '../../fhir/fhir.model';
import { AppointmentDetail, AppointmentStatusRequest, ReadinessFlagView } from '../../models/appointment.model';
import { ApiErrorsService } from '../../i18n/api-errors';
import { intakeFlagLabel, intakeFlagMessage } from '../../i18n/content';
import { fmtClock } from '../../i18n/format';
import { I18nService } from '../../i18n/i18n.service';
import { Lang, TKey } from '../../i18n/i18n.types';
import { businessNow, initials } from '../../shared/link.util';
import { PageTitleService } from '../../shell/page-title.service';

@Component({
  selector: 'app-appointment-detail',
  templateUrl: './appointment-detail.component.html'
})
export class AppointmentDetailComponent implements OnInit {
  id = 0;
  appt: AppointmentDetail | null = null;
  questionnaire: FhirQuestionnaire | null = null;
  accessCode: string | null = null;
  loading = true;
  notFound = false;
  errorMessage: string | null = null;
  initials = initials;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointments: AppointmentService,
    private definitions: QuestionnaireDefinitionService,
    private titles: PageTitleService,
    private notifications: NotificationService,
    public i18n: I18nService,
    private errors: ApiErrorsService
  ) {}

  get formLang(): Lang {
    return this.i18n.lang === 'fr' ? 'fr' : 'en';
  }

  clock(a: AppointmentDetail): string {
    return fmtClock(a.scheduledAt.substring(11, 16), this.i18n.lang);
  }

  flagLabel(f: ReadinessFlagView): string {
    return intakeFlagLabel(f, this.i18n.lang);
  }

  flagMessage(f: ReadinessFlagView): string {
    return intakeFlagMessage(f, this.i18n.lang);
  }

  onLinkSent(patientId: number): void {
    this.notifications.notifySent(patientId);
  }

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  get open(): boolean {
    const s = this.appt?.status;
    return s === 'SCHEDULED' || s === 'READY' || s === 'NEEDS_REVIEW';
  }

  /** The link is usable while the appointment is open and still ahead of us. */
  get canSendLink(): boolean {
    return this.open && !!this.appt && this.appt.scheduledAt > businessNow();
  }

  load(): void {
    this.appointments.get(this.id).subscribe({
      next: a => {
        this.appt = a;
        this.loading = false;
        this.titles.setText(`${this.i18n.t('page.appointment')} · ${a.patientFirstName} ${a.patientLastName}`);
        if (a.intake) {
          this.definitions.get(a.intake.questionnaireDefinitionId).subscribe({
            next: d => (this.questionnaire = d.questionnaire),
            error: () => (this.errorMessage = this.i18n.t('appt.error.definition'))
          });
        }
      },
      error: err => {
        this.loading = false;
        if (err?.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = this.errors.text(err, 'appt.error.load');
        }
      }
    });
  }

  private fail(err?: unknown): void {
    this.errorMessage = this.errors.text(err, 'appt.error.action');
    this.load();
  }

  markReviewed(): void {
    this.errorMessage = null;
    this.appointments.markReviewed(this.id).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  setStatus(status: AppointmentStatusRequest['status'], question: TKey): void {
    if (!window.confirm(this.i18n.t(question))) {
      return;
    }
    this.errorMessage = null;
    this.appointments.setStatus(this.id, status).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  regenerate(): void {
    if (!window.confirm(this.i18n.t('dashboard.confirmNewLink'))) {
      return;
    }
    this.errorMessage = null;
    this.appointments.regenerateCode(this.id).subscribe({
      next: res => {
        this.accessCode = res.accessCode;
        this.load();
      },
      error: err => this.fail(err)
    });
  }

  delete(): void {
    if (!window.confirm(this.i18n.t('appt.confirm.delete'))) {
      return;
    }
    this.errorMessage = null;
    this.appointments.delete(this.id).subscribe({
      next: () => this.router.navigate(['/appointments']),
      error: err => this.fail(err)
    });
  }
}
