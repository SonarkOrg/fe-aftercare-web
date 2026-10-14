import { FhirElement, FhirItem, FhirQuestionnaire } from '../fhir/fhir.model';
import { Alert } from '../models/alert.model';
import { Appointment, AppointmentDetail } from '../models/appointment.model';
import { FollowUp } from '../models/follow-up.model';
import { Patient } from '../models/patient.model';

export const TRANSLATION_URL = 'http://hl7.org/fhir/StructureDefinition/translation';

export function tr(en: string): FhirElement {
  return {
    extension: [{
      url: TRANSLATION_URL,
      extension: [{ url: 'lang', valueCode: 'en' }, { url: 'content', valueString: en }]
    }]
  };
}

const MIN = 'http://hl7.org/fhir/StructureDefinition/minValue';
const MAX = 'http://hl7.org/fhir/StructureDefinition/maxValue';
const DEC = 'http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces';
const UNIT = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';

export const PAIN: FhirItem = {
  linkId: 'PAIN', type: 'integer', required: true, text: 'Intensité de la douleur?', _text: tr('Pain level?'),
  extension: [{ url: MIN, valueInteger: 0 }, { url: MAX, valueInteger: 10 }],
  item: [{ linkId: 'PAIN.help', type: 'display', text: '0 = aucune douleur', _text: tr('0 = no pain') }]
};

export const TEMP: FhirItem = {
  linkId: 'TEMP', type: 'decimal', text: 'Température?', _text: tr('Temperature?'),
  extension: [
    { url: MIN, valueDecimal: 34.0 }, { url: MAX, valueDecimal: 42.0 }, { url: DEC, valueInteger: 1 },
    { url: UNIT, valueCoding: { system: 'http://unitsofmeasure.org', code: 'Cel', display: '°C' } }]
};

export const STEPS: FhirItem = {
  linkId: 'STEPS', type: 'integer', text: 'Nombre de pas?', _text: tr('Number of steps?'),
  extension: [{ url: MIN, valueInteger: 0 }, { url: MAX, valueInteger: 100000 }]
};

export const FEVER: FhirItem = {
  linkId: 'FEVER', type: 'boolean', required: true, text: 'Avez-vous de la fièvre?', _text: tr('Do you have a fever?')
};

export const FEVER_DETAIL: FhirItem = {
  linkId: 'FEVER_DETAIL', type: 'string', required: true, maxLength: 20,
  text: 'Depuis quand?', _text: tr('Since when?'),
  enableWhen: [{ question: 'FEVER', operator: '=', answerBoolean: true }]
};

export const NOTES: FhirItem = {
  linkId: 'NOTES', type: 'text', maxLength: 50, text: 'Notes?', _text: tr('Notes?')
};

export const MOBILITY: FhirItem = {
  linkId: 'MOBILITY', type: 'choice', required: true, text: 'Déplacement?', _text: tr('Mobility?'),
  answerOption: [
    { valueCoding: { system: 'http://x/mobility', code: 'unaided', display: 'Sans aide', _display: tr('Unaided') } },
    { valueCoding: { system: 'http://x/mobility', code: 'bedbound', display: 'Alité', _display: tr('Bedbound') } }]
};

/** Covers every supported item type, a nested help item and an enableWhen. */
export const FULL_Q: FhirQuestionnaire = {
  resourceType: 'Questionnaire',
  url: 'https://aftercare.example/fhir/Questionnaire/test',
  version: '1',
  status: 'active',
  language: 'fr-CA',
  title: 'Suivi de test',
  _title: tr('Test check-in'),
  item: [
    { linkId: 'INTRO', type: 'display', text: 'Répondez une fois par jour.', _text: tr('Answer once a day.') },
    PAIN, TEMP, STEPS, FEVER, FEVER_DETAIL, NOTES, MOBILITY
  ]
};

export const SIMPLE_Q: FhirQuestionnaire = {
  resourceType: 'Questionnaire',
  url: 'https://aftercare.example/fhir/Questionnaire/simple',
  version: '2',
  title: 'Simple',
  _title: tr('Simple form'),
  item: [FEVER]
};

export const JANE: Patient = {
  id: 5, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-0100', gender: 'female',
  address: { city: 'Springfield', state: 'IL', zip: '62701' }
};

export function followUp(over: Partial<FollowUp> = {}): FollowUp {
  return {
    id: 11, patientId: 5, specialty: 'VISCERAL_SURGERY', questionnaireDefinitionId: 7,
    questionnaireUrl: 'https://aftercare.example/fhir/Questionnaire/followup-visceral-surgery', questionnaireVersion: '1',
    dischargeDate: '2026-10-10', durationDays: 7, endDate: '2026-10-17', status: 'ACTIVE',
    accessLinkIssuedAt: '2026-10-10T13:00:00Z', createdAt: '2026-10-10T13:00:00Z', createdBy: 'dev|nurse-1',
    closedAt: null, closedBy: null, ...over
  };
}

export function alertDto(over: Partial<Alert> = {}): Alert {
  return {
    id: 1, patientId: 5, patientFirstName: 'Jane', patientLastName: 'Doe', followUpId: 11, checkInId: 21,
    checkInDate: '2026-10-13', linkId: 'PAIN', questionLabel: 'Pain level?', answerValue: '8', severity: 'HIGH',
    message: 'Severe pain reported (8/10)', messageFr: 'Douleur sévère signalée (8/10)', status: 'OPEN',
    createdAt: '2026-10-13T14:00:00Z', acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, resolvedBy: null,
    resolutionNote: null, ...over
  };
}

export function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 4, patientId: 5, patientFirstName: 'Jane', patientLastName: 'Doe', type: 'PRE_OP_CONSULT',
    specialty: 'ORTHOPEDIC_SURGERY', questionnaireDefinitionId: 9,
    questionnaireUrl: 'https://aftercare.example/fhir/Questionnaire/pre-consult', questionnaireVersion: '1',
    scheduledAt: '2026-10-14T08:30:00', durationMinutes: 30, location: 'Clinic A', clinician: 'Dr. Roy',
    status: 'SCHEDULED', questionnaireMissing: false, intakeSubmittedAt: null, flagCount: 0,
    accessLinkIssuedAt: '2026-10-10T13:00:00Z', reviewedAt: null, reviewedBy: null,
    createdAt: '2026-10-10T13:00:00Z', createdBy: 'dev|nurse-1', updatedAt: '2026-10-10T13:00:00Z', ...over
  };
}

export function appointmentDetail(over: Partial<AppointmentDetail> = {}): AppointmentDetail {
  return { ...appointment(), intake: null, ...over };
}
