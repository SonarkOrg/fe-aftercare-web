import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { MeService } from '../Services/Me.service';
import { Permissions } from '../auth/permissions.service';
import { FhirElement, FhirItem, FhirQuestionnaire } from '../fhir/fhir.model';
import { Alert } from '../models/alert.model';
import { AccessRole, Me, Permission } from '../models/me.model';
import { ContactPreferences, NotificationItem, NotificationSettings } from '../models/notification.model';
import { RetentionRun, RetentionSettings } from '../models/retention.model';
import { Appointment, AppointmentDetail } from '../models/appointment.model';
import { CheckIn, FollowUp } from '../models/follow-up.model';
import { Patient } from '../models/patient.model';
import { RuleJson } from '../models/questionnaire-definition.model';
import { CareTeamMember, EmergencyContact, PatientMedical } from '../models/medical.model';
import { Conversation, Message, PublicMessage, PublicThread, Thread } from '../models/message.model';
import { ReportSummary } from '../models/report.model';
import { ClinicSettings } from '../models/settings.model';
import { Staff } from '../models/staff.model';
import { CareNote, TimelineItem } from '../models/timeline.model';

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
    id: 1, patientId: 5, patientFirstName: 'Jane', patientLastName: 'Doe', followUpId: 11, type: 'CHECK_IN_ANSWER', checkInId: 21,
    checkInDate: '2026-10-13', linkId: 'PAIN', questionLabel: 'Pain level?', questionLabelFr: 'Intensité de la douleur', answerValue: '8', missedDate: null, severity: 'HIGH',
    message: 'Severe pain reported (8/10)', messageFr: 'Douleur sévère signalée (8/10)', status: 'OPEN',
    createdAt: '2026-10-13T14:00:00Z', acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, resolvedBy: null,
    resolutionNote: null, ...over
  };
}

/** A MISSED_CHECKIN alert: no check-in, question or answer, only the day that was missed. */
export function missedAlert(over: Partial<Alert> = {}): Alert {
  return alertDto({
    id: 2, type: 'MISSED_CHECKIN', checkInId: null, checkInDate: null, linkId: null, questionLabel: null, questionLabelFr: null, answerValue: null,
    missedDate: '2026-10-13', severity: 'MEDIUM', message: 'No check-in received for 2026-10-13', messageFr: 'Aucun suivi reçu pour le 2026-10-13', ...over
  });
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
  return { ...appointment(), intake: null, intakeRedacted: false, ...over };
}


export function checkInDto(over: Partial<CheckIn> & { pain?: number; temp?: number } = {}): CheckIn {
  const { pain, temp, ...rest } = over;
  const item: { linkId: string; answer: { valueInteger?: number; valueDecimal?: number }[] }[] = [];
  if (pain !== undefined) {
    item.push({ linkId: 'PAIN', answer: [{ valueInteger: pain }] });
  }
  if (temp !== undefined) {
    item.push({ linkId: 'TEMPERATURE', answer: [{ valueDecimal: temp }] });
  }
  return {
    id: 1, patientId: 5, followUpId: 11, checkInDate: '2026-10-13', submittedAt: '2026-10-13T13:00:00Z',
    questionnaireDefinitionId: 7, questionnaireUrl: 'u', questionnaireVersion: '1',
    response: { resourceType: 'QuestionnaireResponse', questionnaire: 'u|1', status: 'completed', item }, ...rest
  };
}

const msg = { fr: 'x', en: 'x' };
export const SEED_RULES: RuleJson[] = [
  { linkId: 'PAIN', operator: '>=', value: 5, outcome: { type: 'ALERT', severity: 'MEDIUM', message: msg } },
  { linkId: 'PAIN', operator: '>=', value: 7, outcome: { type: 'ALERT', severity: 'HIGH', message: msg } },
  { linkId: 'TEMPERATURE', operator: '>=', value: 37.5, outcome: { type: 'ALERT', severity: 'MEDIUM', message: msg } },
  { linkId: 'TEMPERATURE', operator: '>=', value: 38, outcome: { type: 'ALERT', severity: 'HIGH', message: msg } },
  { linkId: 'FEVER', operator: 'equals-true', outcome: { type: 'ALERT', severity: 'HIGH', message: msg } }
];

/* ---------- patient file, settings, reports, messages ---------- */

export const CLINIC: ClinicSettings = {
  name: 'Clinique Test', addressLine: '1 rue Principale', city: 'Montréal', province: 'QC', postalCode: 'H2X 1Y4', phone: '514-555-0100',
  defaultLanguage: 'FR', notifySeverities: ['HIGH', 'MEDIUM'], updatedAt: null, updatedByName: null
};

const STAMP = { createdAt: '2026-10-01T14:00:00Z', createdByName: 'Dev Nurse', updatedAt: '2026-10-01T14:00:00Z', updatedByName: 'Dev Nurse' };

export function medical(over: Partial<PatientMedical> = {}): PatientMedical {
  return {
    patientId: 5, dateOfBirth: '1980-05-20', healthNumberMasked: 'TREM \u2022\u2022\u2022\u2022 \u2022\u202212',
    allergies: [{ id: 1, substance: 'Penicillin', severity: 'SEVERE', reaction: 'Anaphylaxis', ...STAMP }],
    medications: [{ id: 2, name: 'Acetaminophen', dose: '500 mg', frequency: 'q6h', startDate: '2026-10-01', ...STAMP }],
    procedures: [{ id: 3, name: 'Appendectomy', performedOn: '2026-10-10', surgeonStaffId: null, surgeonName: 'Dr. Roy', ...STAMP }],
    diagnoses: [{ id: 4, description: 'Acute appendicitis', icd10Code: 'K35.80', diagnosedOn: '2026-10-09', ...STAMP }],
    ...over
  };
}

export function staffMember(over: Partial<Staff> = {}): Staff {
  return {
    id: 1, displayName: 'Marie Nurse', email: 'marie@example.com', role: 'NURSE', accessRole: 'NURSE', auth0Subject: null, active: true,
    createdAt: '2026-10-01T14:00:00Z', updatedAt: '2026-10-01T14:00:00Z', ...over
  };
}

export function careTeamMember(over: Partial<CareTeamMember> = {}): CareTeamMember {
  return { assignmentId: 9, staffId: 1, displayName: 'Marie Nurse', role: 'NURSE', active: true, assignedAt: '2026-10-01T14:00:00Z', assignedByName: 'Dev Nurse', ...over };
}

export function contact(over: Partial<EmergencyContact> = {}): EmergencyContact {
  return { id: 7, name: 'John Doe', relationship: 'Spouse', phone: '514-555-0111', preferredLanguage: 'EN', ...STAMP, ...over };
}

export function careNote(over: Partial<CareNote> = {}): CareNote {
  return {
    id: 30, patientId: 5, body: 'Wound looks clean.', notedAt: '2026-10-14T15:00:00Z', createdAt: '2026-10-14T15:00:00Z', editedAt: null,
    authorName: 'Dev Nurse', editableUntil: new Date(Date.now() + 10 * 60_000).toISOString(), editableByMe: true, deletableByMe: true,
    deleted: false, deletedAt: null, deletedByName: null, deleteReason: null, ...over
  };
}

export function timelineItem(over: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: 100, category: 'CHECK_IN', kind: 'CHECK_IN_SUBMITTED', occurredAt: '2026-10-14T15:00:00Z', actorType: 'PATIENT', actorName: null,
    refId: 21, severity: null, summary: 'Check-in submitted for 2026-10-14', summaryFr: 'Suivi quotidien reçu pour le 2026-10-14', note: null, ...over
  };
}

export function message(over: Partial<Message> = {}): Message {
  return {
    id: 1, patientId: 5, sender: 'PATIENT', senderName: null, body: 'Hello', sentAt: '2026-10-14T15:00:00Z',
    readByStaffAt: null, readByPatientAt: null, ...over
  };
}

export function thread(over: Partial<Thread> = {}): Thread {
  return { patientId: 5, messagingOpen: true, messagingOpenUntil: '2026-10-20T04:00:00Z', items: [], hasMore: false, ...over };
}

export function conversation(over: Partial<Conversation> = {}): Conversation {
  return {
    patientId: 5, patientFirstName: 'Jane', patientLastName: 'Doe', lastMessageAt: '2026-10-14T15:00:00Z', lastMessagePreview: 'Hello',
    lastSender: 'PATIENT', unreadCount: 1, messagingOpen: true, ...over
  };
}

export function publicMessage(over: Partial<PublicMessage> = {}): PublicMessage {
  return { id: 1, sender: 'STAFF', senderName: 'Marie', body: 'Bonjour', sentAt: '2026-10-14T15:00:00Z', seen: false, ...over };
}

export function publicThread(over: Partial<PublicThread> = {}): PublicThread {
  return { clinicName: 'Clinique Test', clinicPhone: '514-555-0100', items: [], hasMore: false, unreadCount: 0, ...over };
}

export function report(over: Partial<ReportSummary> = {}): ReportSummary {
  return {
    from: '2026-09-18', to: '2026-10-15', generatedAt: '2026-10-15T14:00:00Z',
    checkIns: { expected: 20, received: 15, completionRate: 0.75, throughDate: '2026-10-14' },
    followUps: { activeNow: 4, started: 6, closed: 2 },
    alerts: { total: 7, high: 3, medium: 4, responded: 6, meanMinutesToAcknowledge: 45, resolved: 5, meanMinutesToResolve: 185, unresolved: 2 },
    appointments: {
      total: 10, completed: 5, cancelled: 2, noShow: 1, questionnairesExpected: 8, questionnairesCompleted: 6, questionnaireCompletionRate: 0.75,
      intakesWithFlags: 2, needsReviewRate: 0.3333, cancellationRate: 0.2, noShowRate: null
    },
    weeks: [
      { weekStart: '2026-09-14', from: '2026-09-18', to: '2026-09-20', checkInsExpected: 4, checkInsReceived: 3, alertsHigh: 1, alertsMedium: 2 },
      { weekStart: '2026-09-21', from: '2026-09-21', to: '2026-09-27', checkInsExpected: 0, checkInsReceived: 0, alertsHigh: 0, alertsMedium: 0 }
    ],
    ...over
  };
}

/* ---------- roles, notifications, retention ---------- */

/** The permission arrays of the Phase A matrix (spec 2.2), in table order. */
export const ROLE_PERMISSIONS: Record<AccessRole, Permission[]> = {
  ADMIN: ['PATIENT_READ', 'PATIENT_WRITE', 'PATIENT_DELETE', 'CLINICAL_READ', 'CLINICAL_WRITE', 'HEALTH_NUMBER_REVEAL',
    'APPOINTMENT_READ', 'APPOINTMENT_WRITE', 'FORMS_READ', 'REPORTS_READ', 'AUDIT_READ',
    'STAFF_READ', 'STAFF_MANAGE', 'SETTINGS_READ', 'SETTINGS_MANAGE'],
  PHYSICIAN: ['PATIENT_READ', 'PATIENT_WRITE', 'CLINICAL_READ', 'CLINICAL_WRITE', 'HEALTH_NUMBER_REVEAL',
    'APPOINTMENT_READ', 'APPOINTMENT_WRITE', 'FORMS_READ', 'REPORTS_READ', 'STAFF_READ', 'SETTINGS_READ'],
  NURSE: ['PATIENT_READ', 'PATIENT_WRITE', 'CLINICAL_READ', 'CLINICAL_WRITE', 'HEALTH_NUMBER_REVEAL',
    'APPOINTMENT_READ', 'APPOINTMENT_WRITE', 'FORMS_READ', 'REPORTS_READ', 'STAFF_READ', 'SETTINGS_READ'],
  RECEPTION: ['PATIENT_READ', 'PATIENT_WRITE', 'APPOINTMENT_READ', 'APPOINTMENT_WRITE', 'FORMS_READ', 'STAFF_READ', 'SETTINGS_READ']
};

const ME_NAME: Record<AccessRole, string> = { ADMIN: 'Dev Admin', PHYSICIAN: 'Dr Alain Bouchard', NURSE: 'Dev Nurse', RECEPTION: 'Dev Reception' };
const ME_SUB: Record<AccessRole, string> = { ADMIN: 'dev|admin-1', PHYSICIAN: 'auth0|seed-surgeon', NURSE: 'dev|nurse-1', RECEPTION: 'dev|reception-1' };

export function me(role: AccessRole = 'NURSE', over: Partial<Me> = {}): Me {
  return {
    staffId: 6, sub: ME_SUB[role], displayName: ME_NAME[role], email: null, role: role === 'ADMIN' ? 'OTHER' : 'NURSE',
    accessRole: role, permissions: [...ROLE_PERMISSIONS[role]], uiLanguage: null, ...over
  };
}

/** Seeds Permissions with a role's member and no HTTP (a stub MeService that never goes to the network). */
export function providePermissions(role: AccessRole | null = 'NURSE', over: Partial<Me> = {}): Provider {
  return {
    provide: Permissions,
    useFactory: () => {
      const m = role ? me(role, over) : null;
      const p = new Permissions({ load: () => of(m!) } as unknown as MeService);
      p.seed(m);
      return p;
    }
  };
}

export function contactPrefs(over: Partial<ContactPreferences> = {}): ContactPreferences {
  return {
    patientId: 5, preferredChannel: 'EMAIL', language: null, effectiveLanguage: 'FR', contactConsent: 'UNKNOWN', consentUpdatedAt: null,
    consentUpdatedByName: null, emailAvailable: true, smsAvailable: true, ...over
  };
}

export function notification(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 1, patientId: 5, followUpId: 11, appointmentId: null, template: 'FOLLOW_UP_LINK', channel: 'EMAIL', language: 'FR', status: 'SENT',
    automated: false, attempts: 1, lastError: null, recipientMasked: 'j\u2022\u2022\u2022@example.com', createdAt: '2026-10-14T15:00:00Z',
    sentAt: '2026-10-14T15:00:30Z', requestedByName: 'Dev Nurse', ...over
  };
}

export function notificationSettings(over: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    emailEnabled: true, smsEnabled: false, emailProvider: 'LOG', smsProvider: 'LOG', checkInReminderEnabled: true, checkInReminderTime: '18:00',
    appointmentReminderEnabled: true, appointmentReminderHours: 48, missedCheckInEnabled: true, missedCheckInCutoff: '20:00',
    updatedAt: null, updatedByName: null, ...over
  };
}

export function retentionSettings(over: Partial<RetentionSettings> = {}): RetentionSettings {
  return {
    closedFollowUpMonths: null, deletedDocumentMonths: null, messageMonths: null, notificationMonths: null, auditMonths: null,
    purgeEnabled: false, dryRun: true, updatedAt: null, updatedByName: null, ...over
  };
}

export function retentionRun(over: Partial<RetentionRun> = {}): RetentionRun {
  return {
    id: 1, mode: 'DRY_RUN', trigger: 'MANUAL', status: 'SUCCEEDED', startedAt: '2026-10-14T15:00:00Z', finishedAt: '2026-10-14T15:00:02Z',
    counts: { followUps: 3, checkIns: 20, alerts: 4, documents: 0, messages: 12, notifications: 40, auditEvents: 0 }, actorName: 'Dev Admin', ...over
  };
}
