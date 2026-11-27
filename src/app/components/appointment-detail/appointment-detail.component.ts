import { NotificationService } from '../../Services/Notification.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from '../../Services/Appointment.service';
import { ArrivalService } from '../../Services/Arrival.service';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { FhirQuestionnaire } from '../../fhir/fhir.model';
import { AppointmentDetail, AppointmentStatusRequest, ReadinessFlagView } from '../../models/appointment.model';
import { ApiErrorsService } from '../../i18n/api-errors';
import { intakeFlagLabel, intakeFlagMessage } from '../../i18n/content';
import { fmtClock } from '../../i18n/format';
import { I18nService } from '../../i18n/i18n.service';
import { Lang, TKey } from '../../i18n/i18n.types';
import type { CardNote } from '../../models/arrival.model';
import { businessToday, initials } from '../../shared/link.util';
import { cardNoteChip, ChipSpec } from '../../shared/status';
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
  /** Who noted the arrival: known right after this page recorded it (the detail DTO carries no name in 1A). */
  arrivedByName: string | null = null;
  arrivalBusy = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointments: AppointmentService,
    private arrivals: ArrivalService,
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

  /** Same rule as the server's linkUsable: open, and the appointment day has not ended (spec 5.6). */
  get canSendLink(): boolean {
    return this.open && !!this.appt && this.hasQuestionnaire(this.appt) && this.appt.scheduledAt.substring(0, 10) >= businessToday();
  }

  /** False only for a walk-in created without a questionnaire (phase 1B): no link, no « missing » warning. */
  hasQuestionnaire(a: AppointmentDetail): boolean {
    return a.questionnaireDefinitionId !== null;
  }

  cardNoteSpec(n: CardNote): ChipSpec {
    return cardNoteChip(n);
  }

  /** Arrival can be noted or undone only for an open appointment of today. */
  get arrivalDay(): boolean {
    return this.open && !!this.appt && this.appt.scheduledAt.substring(0, 10) === businessToday();
  }

  /** The name of whoever noted the arrival, from the detail payload or from the arrival this page just recorded. */
  get arrivedBy(): string | null {
    return this.appt?.arrivedByName ?? this.arrivedByName;
  }

  arrive(): void {
    this.runArrival(this.arrivals.arrive(this.id));
  }

  undoArrival(): void {
    this.runArrival(this.arrivals.undo(this.id));
  }

  /** No confirmation (D5): arrival is idempotent and reversible. */
  private runArrival(obs: ReturnType<ArrivalService['arrive']>): void {
    if (this.arrivalBusy) {
      return;
    }
    this.arrivalBusy = true;
    this.errorMessage = null;
    obs.subscribe({
      next: row => {
        this.arrivalBusy = false;
        this.arrivedByName = row.arrival?.byName ?? null;
        this.load();
      },
      error: err => {
        this.arrivalBusy = false;
        this.errorMessage = this.errors.text(err, 'appts.error.arrive');
        this.load();
      }
    });
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
