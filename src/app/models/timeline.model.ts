import { AlertSeverity } from './alert.model';

export interface Page<T> { items: T[]; page: number; size: number; hasMore: boolean }

export type TimelineCategory = 'NOTE' | 'CHECK_IN' | 'ALERT' | 'APPOINTMENT' | 'FOLLOW_UP' | 'DOCUMENT' | 'MESSAGE';
export type ActivityKind = 'NOTE_ADDED' | 'CHECK_IN_SUBMITTED'
  | 'ALERT_CREATED' | 'ALERT_ACKNOWLEDGED' | 'ALERT_RESOLVED'
  | 'APPOINTMENT_CREATED' | 'APPOINTMENT_RESCHEDULED' | 'APPOINTMENT_STATUS_CHANGED'
  | 'APPOINTMENT_INTAKE_SUBMITTED' | 'APPOINTMENT_DELETED'
  | 'FOLLOW_UP_STARTED' | 'FOLLOW_UP_CLOSED'
  | 'DOCUMENT_UPLOADED' | 'DOCUMENT_DELETED'
  | 'MESSAGE_FROM_PATIENT' | 'MESSAGE_TO_PATIENT';
export type ActorType = 'STAFF' | 'PATIENT' | 'SYSTEM';

export interface NoteCreateRequest { body: string; notedAt: string | null }
export interface NoteEditRequest { body: string }
export interface NoteDeleteRequest { reason: string }

export interface CareNote {
  id: number; patientId: number;
  body: string | null;
  notedAt: string; createdAt: string; editedAt: string | null;
  authorName: string | null;
  editableUntil: string;
  editableByMe: boolean;
  deletableByMe: boolean;
  deleted: boolean; deletedAt: string | null; deletedByName: string | null; deleteReason: string | null;
}

export interface TimelineItem {
  id: number;
  category: TimelineCategory; kind: ActivityKind;
  occurredAt: string;
  actorType: ActorType; actorName: string | null;
  refId: number | null;
  severity: AlertSeverity | null;
  summary: string;
  note: CareNote | null;
}
