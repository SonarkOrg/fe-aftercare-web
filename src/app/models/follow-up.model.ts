import { FhirQuestionnaireResponse } from '../fhir/fhir.model';

export type Specialty = 'VISCERAL_SURGERY' | 'ORTHOPEDIC_SURGERY';
export type FollowUpStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED';

export interface FollowUp {
  id: number;
  patientId: number;
  specialty: Specialty;
  questionnaireDefinitionId: number;
  questionnaireUrl: string;
  questionnaireVersion: string;
  dischargeDate: string;
  durationDays: number;
  endDate: string;
  status: FollowUpStatus;
  accessLinkIssuedAt: string | null;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
}

export interface FollowUpWithCode {
  followUp: FollowUp;
  accessCode: string;
}

export interface CreateFollowUpRequest {
  specialty: Specialty;
  dischargeDate: string;
  durationDays?: number | null;
}

export interface CheckIn {
  id: number;
  followUpId: number;
  checkInDate: string;
  submittedAt: string;
  questionnaireDefinitionId: number;
  questionnaireUrl: string;
  questionnaireVersion: string;
  response: FhirQuestionnaireResponse;
}
