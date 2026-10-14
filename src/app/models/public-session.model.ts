import { FhirQuestionnaire } from '../fhir/fhir.model';
import { AppointmentType } from './appointment.model';

export type PublicKind = 'FOLLOW_UP_CHECKIN' | 'APPOINTMENT_INTAKE';

export interface PublicSession {
  kind: PublicKind;
  submitted: boolean;
  questionnaire: FhirQuestionnaire;
  checkIn: { checkInDate: string; followUpEndDate: string } | null;
  appointment: { type: AppointmentType; scheduledAt: string; durationMinutes: number; location: string | null } | null;
}

export interface PublicSubmitResult {
  kind: PublicKind;
  submittedAt: string;
  checkInDate: string | null;
}
