export type RetentionMode = 'DRY_RUN' | 'PURGE';
export type RetentionTrigger = 'SCHEDULED' | 'MANUAL';
export type RetentionRunStatus = 'SUCCEEDED' | 'FAILED';

export interface RetentionSettingsRequest {
  closedFollowUpMonths: number | null;
  deletedDocumentMonths: number | null;
  messageMonths: number | null;
  notificationMonths: number | null;
  auditMonths: number | null;
}

export interface RetentionSettings extends RetentionSettingsRequest {
  purgeEnabled: boolean;
  dryRun: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface RetentionCounts {
  followUps: number;
  checkIns: number;
  alerts: number;
  documents: number;
  messages: number;
  notifications: number;
  auditEvents: number;
}

export interface RetentionRun {
  id: number;
  mode: RetentionMode;
  trigger: RetentionTrigger;
  status: RetentionRunStatus;
  startedAt: string;
  finishedAt: string | null;
  counts: RetentionCounts;
  actorName: string | null;
}
