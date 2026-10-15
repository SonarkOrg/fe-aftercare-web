import { answerOf } from '../fhir/fhir.util';
import { Alert } from '../models/alert.model';
import { Appointment } from '../models/appointment.model';
import { CheckIn, FollowUp } from '../models/follow-up.model';
import { Patient } from '../models/patient.model';
import { RuleJson } from '../models/questionnaire-definition.model';
import { PatientRow, PatientStatus, SeriesPoint } from './care.model';
import { addDays, businessDateOf, daysBetween, initials } from './link.util';

export const PAIN_LINK = 'PAIN';
export const TEMPERATURE_LINK = 'TEMPERATURE';

export const STATUS_RANK: Record<PatientStatus, number> = { CRITICAL: 0, ATTENTION: 1, STABLE: 2, INACTIVE: 3 };

export interface FollowUpDay { day: number; total: number; ended: boolean }

/** Day 0 is the discharge day. The day is clamped to [0, durationDays]. */
export function followUpDay(f: FollowUp | null | undefined, today: string): FollowUpDay | null {
  if (!f) {
    return null;
  }
  const raw = daysBetween(f.dischargeDate, today);
  return { day: Math.min(Math.max(raw, 0), f.durationDays), total: f.durationDays, ended: today > f.endDate };
}

/**
 * The last follow-up day that may be drawn as "missed" on a chart. Today only counts once it is over (the patient may
 * still check in); a CLOSED follow-up never produces missed ticks after the day it was closed.
 */
export function chartTodayDay(f: FollowUp, checkedInToday: boolean, today: string): number {
  const fd = followUpDay(f, today)!;
  const open = fd.ended || checkedInToday ? fd.day : Math.max(fd.day - 1, 0);
  if (f.status === 'CLOSED' && f.closedAt) {
    const closedDay = Math.min(Math.max(daysBetween(f.dischargeDate, businessDateOf(f.closedAt)), 0), f.durationDays);
    return Math.min(open, closedDay);
  }
  return open;
}

/** Expected check-in days are [dischargeDate + 1 ... endDate]; day 0 is never expected. */
export function isExpectedOn(f: FollowUp | null | undefined, date: string): boolean {
  return !!f && date >= addDays(f.dischargeDate, 1) && date <= f.endDate;
}

export function missedYesterday(f: FollowUp | null | undefined, checkIns: CheckIn[], today: string): boolean {
  if (!f || f.status !== 'ACTIVE') {
    return false;
  }
  const yesterday = addDays(today, -1);
  return isExpectedOn(f, yesterday) && !checkIns.some(c => c.checkInDate === yesterday && c.followUpId === f.id);
}

export interface StatusInput {
  followUp: FollowUp | null | undefined;
  alerts: Alert[];       // unresolved alerts of this patient (OPEN + ACKNOWLEDGED); RESOLVED ones are ignored
  checkIns: CheckIn[];   // check-ins of this follow-up
  today: string;
}

export interface StatusResult { status: PatientStatus; reasons: string[] }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function computeStatus(input: StatusInput): StatusResult {
  const f = input.followUp ?? null;
  const unresolved = input.alerts.filter(a => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED');
  const openHigh = unresolved.filter(a => a.status === 'OPEN' && a.severity === 'HIGH').length;
  const missed = missedYesterday(f, input.checkIns, input.today);
  const active = !!f && f.status === 'ACTIVE';

  const reasons: string[] = [];
  if (openHigh > 0) {
    reasons.push(`${plural(openHigh, 'high alert', 'high alerts')} open`);
  }
  const others = unresolved.length - openHigh;
  if (others > 0) {
    reasons.push(`${plural(others, 'alert', 'alerts')} unresolved`);
  }
  if (missed) {
    reasons.push(`Missed check-in ${addDays(input.today, -1)}`);
  }

  let status: PatientStatus;
  if (openHigh > 0) {
    status = 'CRITICAL';
  } else if (unresolved.length > 0 || missed) {
    status = 'ATTENTION';
  } else if (active) {
    status = 'STABLE';
    reasons.push('On track');
  } else {
    status = 'INACTIVE';
    reasons.push('No active follow-up');
  }
  return { status, reasons };
}

/** Lowest numeric `>=` ALERT threshold for a measure: HIGH rules win over MEDIUM ones. Null when none. */
export function alertThreshold(rules: RuleJson[] | null | undefined, linkId: string): number | null {
  const candidates = (rules ?? []).filter(r =>
    r.linkId === linkId && r.operator === '>=' && r.outcome?.type === 'ALERT' && typeof r.value === 'number');
  if (!candidates.length) {
    return null;
  }
  const high = candidates.filter(r => r.outcome.severity === 'HIGH');
  return Math.min(...(high.length ? high : candidates).map(r => r.value as number));
}

/** Numeric answers of one follow-up as chart points. Day index counts from the discharge date. */
export function buildSeries(f: FollowUp | null | undefined, checkIns: CheckIn[], linkId: string): SeriesPoint[] {
  if (!f) {
    return [];
  }
  const out: SeriesPoint[] = [];
  for (const c of checkIns) {
    if (c.followUpId !== f.id) {
      continue;
    }
    const v = answerOf(c.response, linkId);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      continue;
    }
    out.push({ day: daysBetween(f.dischargeDate, c.checkInDate), date: c.checkInDate, value: v });
  }
  return out.sort((a, b) => a.day - b.day);
}

export interface BuildRowsInput {
  patients: Patient[];
  alerts: Alert[];
  checkIns: CheckIn[];
  appointments: Appointment[];
  rules: Map<number, RuleJson[]>;
  today: string;
  nowLocal: string;
}

const OPEN_APPT = ['SCHEDULED', 'READY', 'NEEDS_REVIEW'];

export function buildRows(input: BuildRowsInput): PatientRow[] {
  const { today, nowLocal } = input;
  return input.patients.map(patient => {
    const id = patient.id!;
    const f = patient.activeFollowUp ?? null;
    const alerts = input.alerts.filter(a => a.patientId === id && (a.status === 'OPEN' || a.status === 'ACKNOWLEDGED'));
    const mine = input.checkIns.filter(c => c.patientId === id);
    const ofFollowUp = f ? mine.filter(c => c.followUpId === f.id) : [];
    const { status, reasons } = computeStatus({ followUp: f, alerts, checkIns: ofFollowUp, today });
    const painSeries = buildSeries(f, ofFollowUp, PAIN_LINK);
    const rules = f ? input.rules.get(f.questionnaireDefinitionId) : undefined;
    const lastCheckInDate = mine.reduce<string | null>((m, c) => (m === null || c.checkInDate > m ? c.checkInDate : m), null);
    const next = input.appointments
      .filter(a => a.patientId === id && OPEN_APPT.includes(a.status) && a.scheduledAt >= nowLocal)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id)[0] ?? null;
    return {
      patient,
      name: `${patient.firstName} ${patient.lastName}`,
      initials: initials(patient.firstName, patient.lastName),
      status, reasons, followUp: f, day: followUpDay(f, today),
      lastCheckInDate, painSeries,
      lastPain: painSeries.length ? painSeries[painSeries.length - 1].value : null,
      painThreshold: alertThreshold(rules, PAIN_LINK),
      openHigh: alerts.filter(a => a.status === 'OPEN' && a.severity === 'HIGH').length,
      unresolved: alerts.length,
      nextAppointment: next,
      missedYesterday: missedYesterday(f, ofFollowUp, today),
      expectedToday: !!f && f.status === 'ACTIVE' && isExpectedOn(f, today),
      checkedInToday: !!f && ofFollowUp.some(c => c.checkInDate === today)
    };
  });
}
