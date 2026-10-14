import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AlertService } from '../../Services/Alert.service';
import { AppointmentService } from '../../Services/Appointment.service';
import { FollowUpService } from '../../Services/FollowUp.service';
import { PatientService } from '../../Services/Patient.service';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { FhirQuestionnaire } from '../../fhir/fhir.model';
import { Alert } from '../../models/alert.model';
import { Appointment } from '../../models/appointment.model';
import { CheckIn, FollowUp, FollowUpWithCode } from '../../models/follow-up.model';
import { Patient } from '../../models/patient.model';
import { humanize } from '../../shared/link.util';

@Component({
  selector: 'app-patient-detail',
  templateUrl: './patient-detail.component.html'
})
export class PatientDetailComponent implements OnInit {
  patientId = 0;
  patient: Patient | null = null;
  followUps: FollowUp[] = [];
  checkIns: CheckIn[] = [];
  alerts: Alert[] = [];
  appointments: Appointment[] = [];
  loading = true;
  notFound = false;
  errorMessage: string | null = null;
  actionError: string | null = null;
  accessCode: string | null = null;
  expanded = new Set<number>();
  defs: Record<number, FhirQuestionnaire> = {};
  humanize = humanize;

  constructor(
    private route: ActivatedRoute,
    private patients: PatientService,
    private followUpService: FollowUpService,
    private alertService: AlertService,
    private appointmentService: AppointmentService,
    private definitions: QuestionnaireDefinitionService
  ) {}

  ngOnInit(): void {
    this.patientId = Number(this.route.snapshot.paramMap.get('id'));
    this.reload();
  }

  get current(): FollowUp | undefined {
    return this.followUps.find(f => f.status !== 'CLOSED');
  }

  get canEnroll(): boolean {
    const c = this.current;
    return !c || c.status === 'EXPIRED';
  }

  reload(): void {
    forkJoin({
      patient: this.patients.getPatient(this.patientId),
      followUps: this.followUpService.listForPatient(this.patientId),
      checkIns: this.followUpService.checkInsForPatient(this.patientId),
      alerts: this.alertService.listForPatient(this.patientId),
      appointments: this.appointmentService.listForPatient(this.patientId)
    }).subscribe({
      next: r => {
        this.patient = r.patient;
        this.followUps = r.followUps;
        this.checkIns = r.checkIns;
        this.alerts = r.alerts;
        this.appointments = r.appointments;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        if (err?.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = 'Could not load patient.';
        }
      }
    });
  }

  onEnrolled(res: FollowUpWithCode): void {
    this.accessCode = res.accessCode;
    this.reload();
  }

  regenerate(f: FollowUp): void {
    if (!window.confirm('The previous link will stop working. Continue?')) {
      return;
    }
    this.actionError = null;
    this.followUpService.regenerateCode(f.id).subscribe({
      next: res => {
        this.accessCode = res.accessCode;
        this.reload();
      },
      error: () => (this.actionError = 'Could not regenerate the link.')
    });
  }

  close(f: FollowUp): void {
    if (!window.confirm('Close this follow-up? The patient link will stop working.')) {
      return;
    }
    this.actionError = null;
    this.followUpService.close(f.id).subscribe({
      next: () => {
        this.accessCode = null;
        this.reload();
      },
      error: () => (this.actionError = 'Could not close the follow-up.')
    });
  }

  toggle(c: CheckIn): void {
    if (this.expanded.has(c.id)) {
      this.expanded.delete(c.id);
      return;
    }
    this.expanded.add(c.id);
    const defId = c.questionnaireDefinitionId;
    if (!this.defs[defId]) {
      this.definitions.get(defId).subscribe({
        next: d => (this.defs[defId] = d.questionnaire),
        error: () => (this.actionError = 'Could not load the form definition.')
      });
    }
  }

  date(a: Appointment): string {
    return a.scheduledAt.substring(0, 10);
  }

  time(a: Appointment): string {
    return a.scheduledAt.substring(11, 16);
  }
}
