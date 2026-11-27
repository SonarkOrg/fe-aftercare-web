import type { AppointmentStatus, AppointmentType } from './appointment.model';
import type { Specialty } from './follow-up.model';
import type { ContactConsent, NotificationChannel } from './notification.model';
import type { Language } from './settings.model';

export type DeskState = 'GO' | 'CHECK' | 'ARRIVED' | 'CLOSED';
export type ArrivalSource = 'DESK' | 'LINK' | 'PORTAL';
export type CardStatus = 'NONE' | 'UNKNOWN' | 'OK' | 'EXPIRING' | 'EXPIRED';
export type CardNote = 'NOT_VALID_TODAY' | 'NO_CARD';
export type SharedCardReason = 'PARENT_CARD_CHILD_UNDER_1' | 'OTHER';

/** Health card state of a file. Never carries the number or its mask (phase 1B, spec 11.2). */
export interface Card {
  onFile: boolean;
  /** "YYYY-MM" */
  expiry: string | null;
  status: CardStatus;
  seenAt: string | null;
  expirySource: 'STAFF' | 'PATIENT' | null;
}

/** The only patient shape on desk endpoints. Never a NAM, never the mask. Later phases append members; ignore the ones you do not know. */
export interface DeskPatient {
  id: number; firstName: string; lastName: string; dateOfBirth: string | null;
  ageYears: number | null; contactMissing: boolean; contactConsent: ContactConsent;
  preferredChannel: NotificationChannel; language: Language | null;
  /** Phase 1B; optional so 1A fixtures compile. */
  card?: Card; possibleDuplicate?: boolean;
}

export interface ArrivalInfo { arrivedAt: string; source: ArrivalSource; byName: string | null }

/** Replaced in phase 1C. */
export type PrevisitSummary = unknown;
/** Replaced in phase 2. */
export type PortalSummary = unknown;

export interface ArrivalRow {
  appointmentId: number; scheduledAt: string; durationMinutes: number; type: AppointmentType;
  clinician: string | null; location: string | null; status: AppointmentStatus; walkIn: boolean; patient: DeskPatient;
  questionnaire: 'RECEIVED' | 'MISSING' | 'NONE'; linkUsable: boolean; arrival: ArrivalInfo | null;
  /** Reasons and notices are code lists; clients ignore codes they do not know (see `reasonChip`). */
  desk: { state: DeskState; reasons: string[]; notices: string[] };
  previsit: PrevisitSummary | null; portal: PortalSummary | null;
  /** Phase 1B. A walk-in without a questionnaire has `questionnaire: 'NONE'`. */
  cardNote?: { note: CardNote; at: string; byName: string | null } | null;
  relatedAppointmentIds?: number[];
}

export interface Arrivals {
  date: string; today: boolean; serverTime: string;
  counts: { expected: number; toCheck: number; arrived: number; walkIns: number; closed: number };
  rows: ArrivalRow[];
  /** Phase 1B: type and specialty pairs that have an active questionnaire. */
  walkInOptions?: { type: AppointmentType; specialty: Specialty }[];
}

export interface TodayAppointment { appointmentId: number; scheduledAt: string; type: AppointmentType; status: AppointmentStatus; arrived: boolean }
export type MatchedBy = 'HEALTH_NUMBER' | 'NAME' | 'DOB' | 'PHONE' | 'CARD_BIRTH_DATE';
export interface PatientMatch { patient: DeskPatient; matchedBy: MatchedBy; todayAppointments: TodayAppointment[] }
export type CardWarning = 'CARD_BIRTH_DATE_MISMATCH' | 'SHARED_CARD';

export interface PatientSearchResult {
  mode: 'HEALTH_NUMBER' | 'NAME' | 'PHONE';
  matches: PatientMatch[];
  candidates: PatientMatch[];
  warnings: CardWarning[];
}

/** Exactly one of the three forms. `healthNumber` needs HEALTH_CARD_CAPTURE. Never log, store or put it in a URL. */
export interface PatientSearchRequest { healthNumber?: string; query?: string; dateOfBirth?: string; phoneDigits?: string }

export interface QuickPatientRequest {
  firstName: string; lastName: string; dateOfBirth: string;
  phone?: string | null; email?: string | null; preferredLanguage?: Language | null;
  contactConsent?: 'GRANTED' | 'WITHDRAWN' | null;
  copyContactFrom?: number | null;
  healthNumber?: string | null; cardExpiry?: string | null;
  sharedCardReason?: SharedCardReason | null;
  confirmNew?: boolean;
}
export interface QuickPatientResponse { patient: DeskPatient; warnings: CardWarning[] }

export interface HealthCardRequest { healthNumber?: string; cardExpiry?: string; seen?: boolean; sharedCardReason?: SharedCardReason | null }
export interface HealthCardResponse { card: Card; warnings: CardWarning[] }

export interface WalkInRequest {
  patientId: number; type: AppointmentType; specialty: Specialty;
  clinician?: string | null; durationMinutes?: number;
}

export interface DuplicateFlag { id: number; a: DeskPatient; b: DeskPatient; flaggedAt: string; flaggedByName: string | null }
export interface DuplicateFlagCreated { id: number; patientId: number; otherPatientId: number; flaggedAt: string }
