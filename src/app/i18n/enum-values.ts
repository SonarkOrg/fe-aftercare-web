import type { AlertSeverity, AlertStatus, AlertType } from '../models/alert.model';
import type { AppointmentStatus, AppointmentType } from '../models/appointment.model';
import type { ArrivalSource, CardNote, SharedCardReason } from '../models/arrival.model';
import type { AuditAction, AuditResource } from '../models/audit.model';
import type { DocumentCategory } from '../models/document.model';
import type { FollowUpStatus, Specialty } from '../models/follow-up.model';
import type { AccessRole } from '../models/me.model';
import type { AllergySeverity } from '../models/medical.model';
import type {
  ContactConsent, EmailProvider, NotificationChannel, NotificationError, NotificationStatus, NotificationTemplate, SmsProvider
} from '../models/notification.model';
import type { RetentionMode, RetentionRunStatus, RetentionTrigger } from '../models/retention.model';
import type { Language } from '../models/settings.model';
import type { StaffRole } from '../models/staff.model';
import type { ActorType, TimelineCategory } from '../models/timeline.model';
import type { PatientStatus } from '../shared/care.model';
import type { EnumGroup } from './enum-key';

// Each record must list every value of its union, or the compiler refuses it. The dictionary spec then checks that each value has a key.
const keys = <T extends string>(r: Record<T, true>): string[] => Object.keys(r);

export const ENUM_VALUES: Record<EnumGroup, string[]> = {
  arrivalSource: keys<ArrivalSource>({ DESK: true, LINK: true, PORTAL: true }),
  cardNote: keys<CardNote>({ NOT_VALID_TODAY: true, NO_CARD: true }),
  sharedCardReason: keys<SharedCardReason>({ PARENT_CARD_CHILD_UNDER_1: true, OTHER: true }),
  accessRole: keys<AccessRole>({ ADMIN: true, PHYSICIAN: true, NURSE: true, RECEPTION: true }),
  staffRole: keys<StaffRole>({
    NURSE: true, NURSE_PRACTITIONER: true, PHYSICIAN: true, SURGEON: true, ANESTHESIOLOGIST: true, PHYSIOTHERAPIST: true, PHARMACIST: true,
    ADMINISTRATIVE: true, OTHER: true
  }),
  appointmentType: keys<AppointmentType>({ PRE_OP_CONSULT: true, SURGERY: true, POST_OP_FOLLOWUP: true, GENERAL_CONSULT: true }),
  appointmentStatus: keys<AppointmentStatus>({ SCHEDULED: true, READY: true, NEEDS_REVIEW: true, CANCELLED: true, COMPLETED: true, NO_SHOW: true }),
  alertSeverity: keys<AlertSeverity>({ HIGH: true, MEDIUM: true }),
  alertStatus: keys<AlertStatus>({ OPEN: true, ACKNOWLEDGED: true, RESOLVED: true }),
  alertType: keys<AlertType>({ CHECK_IN_ANSWER: true, MISSED_CHECKIN: true }),
  patientStatus: keys<PatientStatus>({ CRITICAL: true, ATTENTION: true, STABLE: true, INACTIVE: true }),
  allergySeverity: keys<AllergySeverity>({ SEVERE: true, MODERATE: true, MILD: true, UNKNOWN: true }),
  documentCategory: keys<DocumentCategory>({ DISCHARGE_SUMMARY: true, CONSENT: true, PRESCRIPTION: true, LAB_RESULT: true, IMAGING: true, REFERRAL: true, OTHER: true }),
  specialty: keys<Specialty>({ VISCERAL_SURGERY: true, ORTHOPEDIC_SURGERY: true }),
  followUpDisplayStatus: keys<FollowUpStatus>({ ACTIVE: true, EXPIRED: true, CLOSED: true }),
  questionnairePurpose: keys<'FOLLOW_UP_CHECKIN' | 'PRE_APPOINTMENT'>({ FOLLOW_UP_CHECKIN: true, PRE_APPOINTMENT: true }),
  questionnaireStatus: keys<'ACTIVE' | 'RETIRED'>({ ACTIVE: true, RETIRED: true }),
  actorType: keys<ActorType>({ STAFF: true, PATIENT: true, SYSTEM: true }),
  timelineCategory: keys<TimelineCategory>({ NOTE: true, CHECK_IN: true, ALERT: true, APPOINTMENT: true, FOLLOW_UP: true, DOCUMENT: true, MESSAGE: true }),
  auditAction: keys<AuditAction>({
    PATIENT_FILE_VIEWED: true, PATIENT_UPDATED: true, PATIENT_DELETED: true, HEALTH_NUMBER_SET: true, HEALTH_NUMBER_CLEARED: true, HEALTH_NUMBER_REVEALED: true,
    MEDICAL_ITEM_ADDED: true, MEDICAL_ITEM_UPDATED: true, MEDICAL_ITEM_REMOVED: true, CONTACT_ADDED: true, CONTACT_UPDATED: true, CONTACT_REMOVED: true,
    CARE_TEAM_ASSIGNED: true, CARE_TEAM_UNASSIGNED: true, NOTE_CREATED: true, NOTE_EDITED: true, NOTE_DELETED: true,
    DOCUMENT_UPLOADED: true, DOCUMENT_DOWNLOADED: true, DOCUMENT_DELETED: true, MESSAGE_SENT: true, MESSAGES_VIEWED: true, AUDIT_LOG_VIEWED: true,
    STAFF_CREATED: true, STAFF_UPDATED: true, STAFF_DEACTIVATED: true, STAFF_REACTIVATED: true, CLINIC_SETTINGS_UPDATED: true,
    STAFF_ROLE_CHANGED: true, STAFF_BOOTSTRAPPED: true, ACCESS_DENIED: true, CONTACT_PREFERENCES_UPDATED: true, NOTIFICATION_REQUESTED: true,
    NOTIFICATION_SETTINGS_UPDATED: true, RETENTION_SETTINGS_UPDATED: true, RETENTION_DRY_RUN: true, RETENTION_PURGE: true,
    APPOINTMENT_VIEWED: true, APPOINTMENT_LIST_VIEWED: true, APPOINTMENT_ARRIVED: true, APPOINTMENT_ARRIVAL_UNDONE: true, ACCESS_LINK_ISSUED: true,
    PATIENT_CREATED: true, PATIENT_SEARCHED: true, HEALTH_CARD_UPDATED: true, DUPLICATE_OVERRIDDEN: true, DUPLICATE_FLAGGED: true,
    DUPLICATE_FLAG_CLEARED: true, SEARCH_LIMIT_REACHED: true, APPOINTMENT_CARD_NOTED: true
  }),
  auditResource: keys<AuditResource>({
    PATIENT: true, HEALTH_NUMBER: true, ALLERGY: true, MEDICATION: true, PROCEDURE: true, DIAGNOSIS: true, EMERGENCY_CONTACT: true, CARE_TEAM: true,
    NOTE: true, DOCUMENT: true, MESSAGE: true, AUDIT_LOG: true, STAFF: true, CLINIC_SETTINGS: true, NOTIFICATION: true, RETENTION: true, ENDPOINT: true, APPOINTMENT: true
  }),
  notificationChannel: keys<NotificationChannel>({ EMAIL: true, SMS: true }),
  notificationTemplate: keys<NotificationTemplate>({ FOLLOW_UP_LINK: true, CHECKIN_REMINDER: true, APPOINTMENT_LINK: true, APPOINTMENT_REMINDER: true }),
  notificationStatus: keys<NotificationStatus>({ PENDING: true, SENDING: true, SENT: true, FAILED: true, CANCELLED: true, SKIPPED: true }),
  notificationError: keys<NotificationError>({
    PROVIDER_ERROR: true, PROVIDER_REJECTED: true, INVALID_RECIPIENT: true, NO_CONSENT: true, CHANNEL_DISABLED: true, LINK_UNAVAILABLE: true, NOT_APPLICABLE: true, VOLUME_LIMIT: true
  }),
  contactConsent: keys<ContactConsent>({ UNKNOWN: true, GRANTED: true, WITHDRAWN: true }),
  retentionMode: keys<RetentionMode>({ DRY_RUN: true, PURGE: true }),
  retentionTrigger: keys<RetentionTrigger>({ SCHEDULED: true, MANUAL: true }),
  retentionRunStatus: keys<RetentionRunStatus>({ SUCCEEDED: true, FAILED: true }),
  emailProvider: keys<EmailProvider>({ LOG: true, SMTP: true, OFF: true }),
  smsProvider: keys<SmsProvider>({ LOG: true, TWILIO: true, OFF: true }),
  language: keys<Language>({ FR: true, EN: true })
};
