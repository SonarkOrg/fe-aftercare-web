import type { TKey } from '../../i18n/i18n.types';
import { Alert } from '../../models/alert.model';
import { Appointment } from '../../models/appointment.model';
import { PatientRow } from '../../shared/care.model';
import { addDays, businessDateOf } from '../../shared/link.util';
import { isExpectedOn } from '../../shared/patient-status';

export function openHighAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(a => a.status === 'OPEN' && a.severity === 'HIGH');
}

export function openHigh(alerts: Alert[]): number {
  return openHighAlerts(alerts).length;
}

export function ackHigh(alerts: Alert[]): number {
  return alerts.filter(a => a.status === 'ACKNOWLEDGED' && a.severity === 'HIGH').length;
}

/** Open HIGH alerts created today (America/Toronto date). */
export function newToday(alerts: Alert[], today: string): number {
  return openHighAlerts(alerts).filter(a => businessDateOf(a.createdAt) === today).length;
}

export function unresolvedMedium(alerts: Alert[]): number {
  return alerts.filter(a => a.severity === 'MEDIUM' && (a.status === 'OPEN' || a.status === 'ACKNOWLEDGED')).length;
}

export interface CheckInsToday { received: number; expected: number }

export function checkInsToday(rows: PatientRow[]): CheckInsToday {
  const due = rows.filter(r => r.expectedToday);
  return { expected: due.length, received: due.filter(r => r.checkedInToday).length };
}

export function missedYesterdayCount(rows: PatientRow[]): number {
  return rows.filter(r => r.missedYesterday).length;
}

export function isTodayOrTomorrow(a: Appointment, today: string): boolean {
  const d = a.scheduledAt.substring(0, 10);
  return d === today || d === addDays(today, 1);
}

export interface ToPrepare { needsReview: number; missing: number; total: number }

/** Today and tomorrow only. A NEEDS_REVIEW appointment is never also counted as "missing". */
export function appointmentsToPrepare(appts: Appointment[], today: string): ToPrepare {
  const inRange = appts.filter(a => isTodayOrTomorrow(a, today));
  const needsReview = inRange.filter(a => a.status === 'NEEDS_REVIEW').length;
  const missing = inRange.filter(a => a.status === 'SCHEDULED' && a.questionnaireMissing).length;
  return { needsReview, missing, total: needsReview + missing };
}

export function greeting(hour: number): TKey {
  return hour < 12 ? 'dashboard.greeting.morning' : hour < 18 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
}

const isActive = (r: PatientRow) => r.followUp?.status === 'ACTIVE';

export interface ActiveStats { active: number; stable: number; critical: number; expectedYesterday: number; missedYesterday: number }

/** Counts for the overview ring tiles. "Expected yesterday" = active follow-ups that owed a check-in yesterday. */
export function activeStats(rows: PatientRow[], today: string): ActiveStats {
  const active = rows.filter(isActive);
  const y = addDays(today, -1);
  return {
    active: active.length,
    stable: active.filter(r => r.status === 'STABLE').length,
    critical: active.filter(r => r.status === 'CRITICAL').length,
    expectedYesterday: active.filter(r => isExpectedOn(r.followUp, y)).length,
    missedYesterday: rows.filter(r => r.missedYesterday).length
  };
}

export interface ProgressSegments {
  expected: number;
  received: number;
  /** Expected today and not received yet (segment B). Always 0 for yesterday. */
  pending: number;
  /** Expected yesterday and never received (hatched remainder). Always 0 for today. */
  missed: number;
  aPct: number;
  abPct: number;
}

/**
 * Overview progress bar. A = received, proportional to received/expected; everything else (still due today, or not
 * received yesterday) is the hatched remainder, so B has no width. Nothing expected: no bar. All numbers come from
 * the same snapshot rows.
 */
export function progressSegments(rows: PatientRow[], day: 'today' | 'yesterday', today: string): ProgressSegments {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  if (day === 'today') {
    const { expected, received } = checkInsToday(rows);
    return { expected, received, pending: expected - received, missed: 0, aPct: pct(received, expected), abPct: pct(received, expected) };
  }
  const s = activeStats(rows, today);
  const received = Math.max(s.expectedYesterday - s.missedYesterday, 0);
  return { expected: s.expectedYesterday, received, pending: 0, missed: s.expectedYesterday - received, aPct: pct(received, s.expectedYesterday), abPct: pct(received, s.expectedYesterday) };
}

/** Scale labels 0 % … 100 %: a label within `minGap` percentage points of its neighbour is dropped (the end labels win). */
export function scaleLabels(a: number, ab: number, minGap = 8): number[] {
  const out: number[] = [0];
  for (const v of [a, ab]) {
    if (v - out[out.length - 1] >= minGap && 100 - v >= minGap) {
      out.push(v);
    }
  }
  out.push(100);
  return out;
}
