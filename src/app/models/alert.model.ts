export type AlertSeverity = 'HIGH' | 'MEDIUM';
export type AlertType = 'CHECK_IN_ANSWER' | 'MISSED_CHECKIN';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  id: number;
  patientId: number;
  patientFirstName: string;
  patientLastName: string;
  followUpId: number;
  type: AlertType;
  /** Null for MISSED_CHECKIN alerts (the day is `missedDate`). */
  checkInId: number | null;
  checkInDate: string | null;
  linkId: string | null;
  questionLabel: string | null;
  answerValue: string | null;
  /** The day that was missed (MISSED_CHECKIN), else null. */
  missedDate: string | null;
  severity: AlertSeverity;
  message: string;
  messageFr: string;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface ResolveAlertRequest {
  note: string;
}
