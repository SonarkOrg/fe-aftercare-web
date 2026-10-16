import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from '../../Services/Appointment.service';
import { PatientService } from '../../Services/Patient.service';
import { apiErrorOf } from '../../models/api-error.model';
import { Appointment, AppointmentType, AppointmentWithCode } from '../../models/appointment.model';
import { Specialty } from '../../models/follow-up.model';
import { Patient } from '../../models/patient.model';
import { humanize, businessToday } from '../../shared/link.util';

@Component({
  selector: 'app-appointment-form',
  templateUrl: './appointment-form.component.html'
})
export class AppointmentFormComponent implements OnInit {
  editId: number | null = null;
  loaded = this.editId === null;
  patients: Patient[] = [];
  patientId: number | null = null;
  type: AppointmentType = 'GENERAL_CONSULT';
  specialty: Specialty = 'VISCERAL_SURGERY';
  date = businessToday();
  time = '08:00';
  durationMinutes = 30;
  location = '';
  clinician = '';

  types: AppointmentType[] = ['PRE_OP_CONSULT', 'SURGERY', 'POST_OP_FOLLOWUP', 'GENERAL_CONSULT'];
  specialties: Specialty[] = ['VISCERAL_SURGERY', 'ORTHOPEDIC_SURGERY'];
  humanize = humanize;

  saving = false;
  error: string | null = null;
  fieldErrors: Record<string, string> = {};
  created: AppointmentWithCode | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointments: AppointmentService,
    private patientService: PatientService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = Number(id);
      this.loaded = false;
      this.appointments.get(this.editId).subscribe({
        next: a => this.fill(a),
        error: () => (this.error = 'Could not load the appointment.')
      });
    }
    const pid = this.route.snapshot.queryParamMap.get('patientId');
    if (pid) {
      this.patientId = Number(pid);
    }
    this.patientService.getPatientList().subscribe({
      next: list => (this.patients = list),
      error: () => (this.error = 'Could not load patients.')
    });
  }

  get fieldErrorList(): string[] {
    return Object.entries(this.fieldErrors).map(([k, v]) => `${k}: ${v}`);
  }

  private fill(a: Appointment): void {
    this.loaded = true;
    this.patientId = a.patientId;
    this.type = a.type;
    this.specialty = a.specialty ?? this.specialty;
    this.date = a.scheduledAt.substring(0, 10);
    this.time = a.scheduledAt.substring(11, 16);
    this.durationMinutes = a.durationMinutes;
    this.location = a.location ?? '';
    this.clinician = a.clinician ?? '';
  }

  submit(): void {
    this.error = null;
    this.fieldErrors = {};
    if (this.patientId === null) {
      this.error = 'Select a patient.';
      return;
    }
    this.saving = true;
    const body = {
      type: this.type,
      specialty: this.specialty,
      scheduledAt: `${this.date}T${this.time}:00`,
      durationMinutes: this.durationMinutes,
      location: this.location.trim() || null,
      clinician: this.clinician.trim() || null
    };
    if (this.editId !== null) {
      const id = this.editId;
      this.appointments.update(id, body).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/appointments', id]);
        },
        error: err => this.fail(err)
      });
    } else {
      this.appointments.create({ patientId: this.patientId, ...body }).subscribe({
        next: res => {
          this.saving = false;
          this.created = res;
        },
        error: err => this.fail(err)
      });
    }
  }

  private fail(err: unknown): void {
    this.saving = false;
    const api = apiErrorOf(err);
    if (api?.error === 'VALIDATION_FAILED') {
      this.fieldErrors = api.fieldErrors;
      this.error = Object.keys(api.fieldErrors).length ? null : 'Please check the form.';
    } else if (api?.error === 'NO_ACTIVE_QUESTIONNAIRE') {
      this.error = 'No active form is configured for this appointment type.';
    } else if ((err as { status?: number })?.status === 409) {
      this.error = 'This appointment can no longer be edited.';
    } else {
      this.error = 'Could not save the appointment.';
    }
  }
}
