export type AlertSeverity = 'HIGH' | 'MEDIUM';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  id: number;
  patientId: number;
  patientFirstName: string;
  patientLastName: string;
  followUpId: number;
  checkInId: number;
  checkInDate: string;
  linkId: string;
  questionLabel: string;
  answerValue: string;
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
