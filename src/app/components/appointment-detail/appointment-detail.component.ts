import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from '../../Services/Appointment.service';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { FhirQuestionnaire } from '../../fhir/fhir.model';
import { AppointmentDetail, AppointmentStatusRequest } from '../../models/appointment.model';
import { humanize } from '../../shared/link.util';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointments: AppointmentService,
    private definitions: QuestionnaireDefinitionService
  ) {}

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  get open(): boolean {
    const s = this.appt?.status;
    return s === 'SCHEDULED' || s === 'READY' || s === 'NEEDS_REVIEW';
  }

  load(): void {
    this.appointments.get(this.id).subscribe({
      next: a => {
        this.appt = a;
        this.loading = false;
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

  private fail(): void {
    this.errorMessage = 'Action failed. The appointment may have changed; reloading.';
    this.load();
  }

  markReviewed(): void {
    this.errorMessage = null;
    this.appointments.markReviewed(this.id).subscribe({ next: () => this.load(), error: () => this.fail() });
  }

  setStatus(status: AppointmentStatusRequest['status'], question: string): void {
    if (!window.confirm(question)) {
      return;
    }
    this.errorMessage = null;
    this.appointments.setStatus(this.id, status).subscribe({ next: () => this.load(), error: () => this.fail() });
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
      error: () => this.fail()
    });
  }

  delete(): void {
    if (!window.confirm('Delete this appointment?')) {
      return;
    }
    this.errorMessage = null;
    this.appointments.delete(this.id).subscribe({
      next: () => this.router.navigate(['/appointments']),
      error: () => this.fail()
    });
  }
}
