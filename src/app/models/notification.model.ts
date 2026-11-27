import { Language } from './settings.model';

export type NotificationChannel = 'EMAIL' | 'SMS';
export type NotificationTemplate = 'FOLLOW_UP_LINK' | 'CHECKIN_REMINDER' | 'APPOINTMENT_LINK' | 'APPOINTMENT_REMINDER';
export type NotificationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
export type NotificationError = 'PROVIDER_ERROR' | 'PROVIDER_REJECTED' | 'INVALID_RECIPIENT' | 'NO_CONSENT'
  | 'CHANNEL_DISABLED' | 'LINK_UNAVAILABLE' | 'NOT_APPLICABLE' | 'VOLUME_LIMIT';
export type ContactConsent = 'UNKNOWN' | 'GRANTED' | 'WITHDRAWN';
export type EmailProvider = 'LOG' | 'SMTP' | 'OFF';
export type SmsProvider = 'LOG' | 'TWILIO' | 'OFF';
/** PRIV-A-17b: NEUTRAL (default) mentions neither surgery nor follow-up. */
export type MessageWording = 'STANDARD' | 'NEUTRAL';
export const MESSAGE_WORDINGS: MessageWording[] = ['NEUTRAL', 'STANDARD'];

export interface ContactPreferences {
  patientId: number;
  preferredChannel: NotificationChannel;
  language: Language | null;
  effectiveLanguage: Language;
  contactConsent: ContactConsent;
  consentUpdatedAt: string | null;
  consentUpdatedByName: string | null;
  emailAvailable: boolean;
  smsAvailable: boolean;
}

export interface ContactPreferencesRequest {
  preferredChannel: NotificationChannel;
  language: Language | null;
  contactConsent: ContactConsent;
}

export interface NotificationItem {
  id: number;
  patientId: number;
  followUpId: number | null;
  appointmentId: number | null;
  template: NotificationTemplate;
  channel: NotificationChannel;
  language: Language;
  status: NotificationStatus;
  automated: boolean;
  attempts: number;
  lastError: NotificationError | null;
  recipientMasked: string | null;
  createdAt: string;
  sentAt: string | null;
  requestedByName: string | null;
}

export interface SendLinkRequest {
  channel: NotificationChannel | null;
}

export interface NotificationSettingsRequest {
  emailEnabled: boolean;
  smsEnabled: boolean;
  checkInReminderEnabled: boolean;
  /** "HH:mm" */
  checkInReminderTime: string;
  appointmentReminderEnabled: boolean;
  /** 24..72 */
  appointmentReminderHours: number;
  missedCheckInEnabled: boolean;
  /** "HH:mm" */
  missedCheckInCutoff: string;
  /** Absent = unchanged (the API will make it required with PRIV-A-17b). */
  messageWording?: MessageWording;
}

export interface NotificationSettings extends NotificationSettingsRequest {
  messageWording: MessageWording;
  emailProvider: EmailProvider;
  smsProvider: SmsProvider;
  updatedAt: string | null;
  updatedByName: string | null;
}
