import { FhirQuestionnaireResponse } from '../fhir/fhir.model';
import type { ArrivalSource, CardNote } from './arrival.model';
import { Specialty } from './follow-up.model';

export type AppointmentType = 'PRE_OP_CONSULT' | 'SURGERY' | 'POST_OP_FOLLOWUP' | 'GENERAL_CONSULT';
export type AppointmentStatus = 'SCHEDULED' | 'READY' | 'NEEDS_REVIEW' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface Appointment {
  id: number;
  patientId: number;
  patientFirstName: string;
  patientLastName: string;
  type: AppointmentType;
  /** Null when redacted for the caller (RECEPTION). */
  specialty: Specialty | null;
  /** The three questionnaire members are null only for a walk-in without a questionnaire (phase 1B). */
  questionnaireDefinitionId: number | null;
  questionnaireUrl: string | null;
  questionnaireVersion: string | null;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  clinician: string | null;
  status: AppointmentStatus;
  questionnaireMissing: boolean;
  intakeSubmittedAt: string | null;
  flagCount: number;
  accessLinkIssuedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  arrivedAt: string | null;
  arrivalSource: ArrivalSource | null;
  walkIn: boolean;
  /** Phase 1B: a marker for whoever bills; absent on older payloads. */
  cardNote?: CardNote | null;
}

export interface AppointmentWithCode {
  appointment: Appointment;
  /** Null for callers without CLINICAL_READ (A-44: reception sends the link, never sees the code). */
  accessCode: string | null;
}

export interface ReadinessFlagView {
  linkId: string;
  label: string;
  labelFr: string | null;
  message: string;
  messageFr: string;
}

export type IntakeFlag = ReadinessFlagView;

export interface Intake {
  submittedAt: string;
  questionnaireDefinitionId: number;
  questionnaireUrl: string;
  questionnaireVersion: string;
  response: FhirQuestionnaireResponse;
  flags: ReadinessFlagView[];
}

export interface AppointmentDetail extends Appointment {
  intake: Intake | null;
  /** True when the caller may not see the answers (no CLINICAL_READ); `intake` is then null. */
  intakeRedacted: boolean;
  /** Staff member who recorded the arrival (« Noté par »); null when not arrived. Detail endpoint only. */
  arrivedByName?: string | null;
}

export interface CreateAppointmentRequest {
  patientId: number;
  type: AppointmentType;
  specialty: Specialty;
  scheduledAt: string;
  durationMinutes: number;
  location?: string | null;
  clinician?: string | null;
}

export type UpdateAppointmentRequest = Omit<CreateAppointmentRequest, 'patientId'>;

export interface AppointmentStatusRequest {
  status: 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
}

export interface AppointmentMetrics {
  from: string;
  to: string;
  total: number;
  scheduled: number;
  ready: number;
  needsReview: number;
  cancelled: number;
  completed: number;
  noShow: number;
  questionnairesCompleted: number;
  questionnaireMissing: number;
  completionRate: number | null;
  /** Open or completed appointments with an arrival (phase 1A). */
  arrived: number;
  walkIns: number;
}
