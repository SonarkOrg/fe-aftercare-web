import { FhirQuestionnaireResponse } from '../fhir/fhir.model';
import { Specialty } from './follow-up.model';

export type AppointmentType = 'PRE_OP_CONSULT' | 'SURGERY' | 'POST_OP_FOLLOWUP' | 'GENERAL_CONSULT';
export type AppointmentStatus = 'SCHEDULED' | 'READY' | 'NEEDS_REVIEW' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface Appointment {
  id: number;
  patientId: number;
  patientFirstName: string;
  patientLastName: string;
  type: AppointmentType;
  specialty: Specialty;
  questionnaireDefinitionId: number;
  questionnaireUrl: string;
  questionnaireVersion: string;
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
}

export interface AppointmentWithCode {
  appointment: Appointment;
  accessCode: string;
}

export interface ReadinessFlagView {
  linkId: string;
  label: string;
  message: string;
  messageFr: string;
}

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
}
