import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from '../../Services/Appointment.service';
import { PatientService } from '../../Services/Patient.service';
import { ApiErrorsService } from '../../i18n/api-errors';
import { I18nService } from '../../i18n/i18n.service';
import { TKey } from '../../i18n/i18n.types';
import { apiErrorOf } from '../../models/api-error.model';
import { Appointment, AppointmentType, AppointmentWithCode } from '../../models/appointment.model';
import { Specialty } from '../../models/follow-up.model';
import { Patient } from '../../models/patient.model';
import { businessToday } from '../../shared/link.util';

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

  saving = false;
  error: string | null = null;
  fieldErrors: Record<string, string> = {};
  created: AppointmentWithCode | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appointments: AppointmentService,
    private patientService: PatientService,
    private i18n: I18nService,
    private errors: ApiErrorsService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = Number(id);
      this.loaded = false;
      this.appointments.get(this.editId).subscribe({
        next: a => this.fill(a),
        error: err => (this.error = this.errors.text(err, 'apptForm.error.loadAppt'))
      });
    }
    const pid = this.route.snapshot.queryParamMap.get('patientId');
    if (pid) {
      this.patientId = Number(pid);
    }
    this.patientService.getPatientList().subscribe({
      next: list => (this.patients = list),
      error: err => (this.error = this.errors.text(err, 'apptForm.error.loadPatients'))
    });
  }

  get fieldErrorList(): string[] {
    const labels: Record<string, TKey> = {
      scheduledAt: 'apptForm.field.scheduledAt', durationMinutes: 'apptForm.field.durationMinutes', location: 'appt.location',
      clinician: 'appt.clinician', type: 'appt.type', specialty: 'appt.specialty'
    };
    return Object.entries(this.fieldErrors).map(([k, v]) => {
      const text = this.errors.fieldText(k, v);
      return labels[k] ? this.i18n.t('common.withColon', { label: this.i18n.t(labels[k]) }) + ' ' + text : text;
    });
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
      this.error = this.i18n.t('apptForm.error.selectPatient');
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
      this.error = Object.keys(api.fieldErrors).length ? null : this.i18n.t('error.code.VALIDATION_FAILED');
    } else {
      this.error = this.errors.text(err, 'apptForm.error.save', { NO_ACTIVE_QUESTIONNAIRE: 'error.msg.noQType', INVALID_STATE: 'apptForm.error.locked' });
    }
  }
}
