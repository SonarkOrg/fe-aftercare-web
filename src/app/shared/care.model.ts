import { Alert } from '../models/alert.model';
import { Appointment } from '../models/appointment.model';
import { CheckIn, FollowUp } from '../models/follow-up.model';
import { Patient } from '../models/patient.model';

export type PatientStatus = 'CRITICAL' | 'ATTENTION' | 'STABLE' | 'INACTIVE';

export interface SeriesPoint { day: number; date: string; value: number | null }

export interface PatientRow {
  patient: Patient; name: string; initials: string;
  status: PatientStatus; reasons: string[];
  followUp: FollowUp | null; day: { day: number; total: number; ended: boolean } | null;
  lastCheckInDate: string | null;
  painSeries: SeriesPoint[];
  lastPain: number | null; painThreshold: number | null;
  openHigh: number; unresolved: number;
  nextAppointment: Appointment | null;
  missedYesterday: boolean; expectedToday: boolean; checkedInToday: boolean;
}

export interface CareSnapshot {
  today: string;
  rows: PatientRow[];
  alerts: Alert[];
  checkIns: CheckIn[];
  appointments: Appointment[];
}
