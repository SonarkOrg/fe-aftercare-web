import { NotificationService } from '../../Services/Notification.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from '../../Services/Appointment.service';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { FhirQuestionnaire } from '../../fhir/fhir.model';
import { AppointmentDetail, AppointmentStatusRequest } from '../../models/appointment.model';
import { errorText } from '../../models/api-error.model';
import { businessNow, humanize, initials } from '../../shared/link.util';
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
  humanize = humanize;
  initials = initials;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointments: AppointmentService,
    private definitions: QuestionnaireDefinitionService,
    private titles: PageTitleService,
    private notifications: NotificationService
  ) {}

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
        this.titles.set(`Appointment · ${a.patientFirstName} ${a.patientLastName}`);
        if (a.intake) {
          this.definitions.get(a.intake.questionnaireDefinitionId).subscribe({
            next: d => (this.questionnaire = d.questionnaire),
            error: () => (this.errorMessage = 'Could not load the form definition.')
          });
        }
      },
      error: err => {
        this.loading = false;
        if (err?.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = 'Could not load appointment.';
        }
      }
    });
  }

  private fail(err?: unknown): void {
    this.errorMessage = errorText(err, 'Action failed. The appointment may have changed; reloading.');
    this.load();
  }

  markReviewed(): void {
    this.errorMessage = null;
    this.appointments.markReviewed(this.id).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  setStatus(status: AppointmentStatusRequest['status'], question: string): void {
    if (!window.confirm(question)) {
      return;
    }
    this.errorMessage = null;
    this.appointments.setStatus(this.id, status).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  regenerate(): void {
    if (!window.confirm('The previous link will stop working. Continue?')) {
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
    if (!window.confirm('Delete this appointment?')) {
      return;
    }
    this.errorMessage = null;
    this.appointments.delete(this.id).subscribe({
      next: () => this.router.navigate(['/appointments']),
      error: err => this.fail(err)
    });
  }
}
