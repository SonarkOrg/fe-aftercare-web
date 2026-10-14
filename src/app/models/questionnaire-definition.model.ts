import { FhirQuestionnaire } from '../fhir/fhir.model';
import { AppointmentType } from './appointment.model';
import { Specialty } from './follow-up.model';

export interface LocalizedText {
  fr: string;
  en: string;
}

export interface QuestionnaireDefinition {
  id: number;
  url: string;
  version: string;
  title: LocalizedText;
  purpose: 'FOLLOW_UP_CHECKIN' | 'PRE_APPOINTMENT';
  specialty: Specialty | null;
  appointmentTypes: AppointmentType[];
  status: 'ACTIVE' | 'RETIRED';
  loadedAt: string;
}

export interface RuleJson {
  linkId: string;
  operator: string;
  value?: number | string[];
  outcome: {
    type: 'ALERT' | 'NEEDS_REVIEW';
    severity?: 'HIGH' | 'MEDIUM';
    message: LocalizedText;
  };
}

export interface QuestionnaireDefinitionDetail extends QuestionnaireDefinition {
  questionnaire: FhirQuestionnaire;
  rules: RuleJson[];
}
