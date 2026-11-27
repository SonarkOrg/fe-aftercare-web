import type { AppointmentStatus, AppointmentType } from './appointment.model';
import type { ContactConsent, NotificationChannel } from './notification.model';
import type { Language } from './settings.model';

export type DeskState = 'GO' | 'CHECK' | 'ARRIVED' | 'CLOSED';
export type ArrivalSource = 'DESK' | 'LINK' | 'PORTAL';

/** The only patient shape on desk endpoints. Never a NAM, never the mask. Later phases append members; ignore the ones you do not know. */
export interface DeskPatient {
  id: number; firstName: string; lastName: string; dateOfBirth: string | null;
  ageYears: number | null; contactMissing: boolean; contactConsent: ContactConsent;
  preferredChannel: NotificationChannel; language: Language | null;
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
}

export interface Arrivals {
  date: string; today: boolean; serverTime: string;
  counts: { expected: number; toCheck: number; arrived: number; walkIns: number; closed: number };
  rows: ArrivalRow[];
}
