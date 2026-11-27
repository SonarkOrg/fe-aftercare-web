import { AlertSeverity, AlertStatus } from '../models/alert.model';
import { AppointmentStatus } from '../models/appointment.model';
import type { CardNote, CardStatus, DeskState } from '../models/arrival.model';
import { AllergySeverity } from '../models/medical.model';
import { TimelineItem } from '../models/timeline.model';
import { PatientStatus } from './care.model';
import { IconName } from './icon/icon.component';
import { AnyLang, Msg, TKey } from '../i18n/i18n.types';
import { fmtDayShort } from './messages.util';

export type Tone = 'critical' | 'serious' | 'warning' | 'good' | 'info' | 'neutral';
/** `short` is a compact word for narrow cards; `label` stays the long, spoken form. Both are dictionary keys (or key + params). */
export interface ChipSpec { tone: Tone; glyph: string; label: Msg; short?: Msg }

type Text = TKey | Msg;
const msg = (t: Text): Msg => (typeof t === 'string' ? { key: t } : t);

export const GLYPH: Record<Tone, string> = { critical: '▲', serious: '◆', warning: '●', good: '✓', info: 'ℹ', neutral: '—' };

function chip(tone: Tone, label: Text, glyph: string = GLYPH[tone], short?: Text): ChipSpec {
  return short ? { tone, glyph, label: msg(label), short: msg(short) } : { tone, glyph, label: msg(label) };
}

export function patientStatusChip(s: PatientStatus): ChipSpec {
  switch (s) {
    case 'CRITICAL': return chip('critical', 'enum.patientStatus.CRITICAL');
    case 'ATTENTION': return chip('warning', 'enum.patientStatus.ATTENTION');
    case 'STABLE': return chip('good', 'enum.patientStatus.STABLE');
    default: return chip('neutral', 'enum.patientStatus.INACTIVE');
  }
}

export function severityChip(s: AlertSeverity): ChipSpec {
  return s === 'HIGH' ? chip('critical', 'enum.alertSeverity.HIGH') : chip('warning', 'enum.alertSeverity.MEDIUM');
}

export function alertStatusChip(s: AlertStatus): ChipSpec {
  switch (s) {
    case 'OPEN': return chip('serious', 'enum.alertStatus.OPEN');
    case 'ACKNOWLEDGED': return chip('info', 'enum.alertStatus.ACKNOWLEDGED');
    default: return chip('good', 'enum.alertStatus.RESOLVED');
  }
}

export function appointmentChip(a: { status: AppointmentStatus; questionnaireMissing: boolean }): ChipSpec {
  switch (a.status) {
    case 'NEEDS_REVIEW': return chip('serious', 'enum.appointmentStatus.NEEDS_REVIEW', undefined, 'chip.appt.reviewShort');
    case 'READY': return chip('good', 'enum.appointmentStatus.READY');
    case 'COMPLETED': return chip('neutral', 'enum.appointmentStatus.COMPLETED', '✓');
    case 'CANCELLED': return chip('neutral', 'enum.appointmentStatus.CANCELLED', '✕');
    case 'NO_SHOW': return chip('neutral', 'enum.appointmentStatus.NO_SHOW', '⊘');
    default:
      return a.questionnaireMissing ? chip('warning', 'chip.appt.questionnaireMissing', undefined, 'chip.appt.questionnaireMissingShort') : chip('info', 'chip.appt.awaitingQuestionnaire');
  }
}

export function deskChip(state: DeskState): ChipSpec {
  switch (state) {
    case 'GO': return chip('good', 'chip.desk.GO');
    case 'CHECK': return chip('warning', 'chip.desk.CHECK');
    case 'ARRIVED': return chip('good', 'chip.desk.ARRIVED');
    default: return chip('neutral', 'chip.desk.CLOSED');
  }
}

/** A reason or notice code of a desk row. Unknown codes (a later phase) return null and are not rendered. */
export function reasonChip(code: string): ChipSpec | null {
  switch (code) {
    case 'QUESTIONNAIRE_MISSING': return chip('warning', 'chip.reason.QUESTIONNAIRE_MISSING');
    case 'CONTACT_MISSING': return chip('warning', 'chip.reason.CONTACT_MISSING');
    case 'DOB_MISSING': return chip('warning', 'chip.reason.DOB_MISSING');
    case 'CONSENT_UNKNOWN': return chip('info', 'chip.reason.CONSENT_UNKNOWN');
    case 'CARD_EXPIRED': return chip('critical', 'chip.reason.CARD_EXPIRED');
    case 'CARD_EXPIRING': return chip('warning', 'chip.reason.CARD_EXPIRING');
    case 'CARD_NOT_ON_FILE': return chip('neutral', 'chip.reason.CARD_NOT_ON_FILE');
    case 'CARD_EXPIRY_UNKNOWN': return chip('info', 'chip.reason.CARD_EXPIRY_UNKNOWN');
    case 'POSSIBLE_DUPLICATE': return chip('neutral', 'chip.reason.POSSIBLE_DUPLICATE');
    default: return null;
  }
}

/**
 * « Sur place » only while the appointment is open: on a closed one the arrival columns are history (spec 6.3), and a
 * « Terminé » next to « Sur place » would read as a patient still in the waiting room.
 */
export function arrivalChip(a: { arrivedAt: string | null; status: AppointmentStatus }): ChipSpec | null {
  const open = a.status === 'SCHEDULED' || a.status === 'READY' || a.status === 'NEEDS_REVIEW';
  return a.arrivedAt && open ? chip('good', 'chip.desk.ARRIVED') : null;
}

/** The state of a health card on a file (never « valide »: we have no access to the RAMQ eligibility service). */
export function cardChip(card: { status: CardStatus; onFile?: boolean }): ChipSpec {
  if (card.onFile === false && card.status !== 'NONE') {
    // an expiry was noted but no number is on file: never « Carte au dossier » (review p1b)
    return chip('info', 'chip.card.EXPIRY_ONLY');
  }
  switch (card.status) {
    case 'OK': return chip('good', 'chip.card.OK');
    case 'EXPIRING': return chip('warning', 'chip.card.EXPIRING');
    case 'EXPIRED': return chip('critical', 'chip.card.EXPIRED');
    case 'UNKNOWN': return chip('info', 'chip.card.UNKNOWN');
    default: return chip('neutral', 'chip.card.NONE');
  }
}

/** The tag of a visit created at the desk without an appointment. */
export function walkInChip(): ChipSpec {
  return chip('neutral', 'appts.walkInTag');
}

/** A walk-in without a questionnaire (no link exists): neutral, so the desk can tell it apart. */
export function noQuestionnaireChip(): ChipSpec {
  return chip('neutral', 'appts.noQuestionnaire');
}

/** The marker the desk puts on an arrived row for whoever bills; neutral, it blocks nothing. */
export function cardNoteChip(note: CardNote): ChipSpec {
  return chip('neutral', note === 'NO_CARD' ? 'chip.cardNote.NO_CARD' : 'chip.cardNote.NOT_VALID_TODAY');
}

export function allergyChip(s: AllergySeverity): ChipSpec {
  switch (s) {
    case 'SEVERE': return chip('critical', 'enum.allergySeverity.SEVERE');
    case 'MODERATE': return chip('serious', 'enum.allergySeverity.MODERATE');
    case 'MILD': return chip('warning', 'enum.allergySeverity.MILD');
    default: return chip('neutral', 'enum.allergySeverity.UNKNOWN');
  }
}

export function staffActiveChip(active: boolean): ChipSpec {
  return active ? chip('good', 'common.active') : chip('neutral', 'common.inactive', '⊘');
}

/** PRIV-A-23: the person in charge of the protection of information. Neutral on purpose: a role marker, not a state. */
export function privacyOfficerChip(): ChipSpec {
  return chip('neutral', 'staff.chip.privacyOfficer');
}

export function linkedChip(linked: boolean): ChipSpec {
  return linked ? chip('info', 'common.linked') : chip('neutral', 'common.notLinked');
}

/** `until` is exclusive (Toronto midnight after the last open day), so the label names the day before. */
export function messagingChip(open: boolean, until: string | null, lang: AnyLang = 'en'): ChipSpec {
  return open
    ? chip('good', until ? { key: 'chip.messaging.openThrough', params: { date: fmtDayShort(new Date(Date.parse(until) - 1).toISOString(), lang) } } : 'chip.messaging.open')
    : chip('neutral', 'chip.messaging.closed', '⊘');
}

export function ruleOutcomeChip(o: { type: 'ALERT' | 'NEEDS_REVIEW'; severity?: 'HIGH' | 'MEDIUM' }): ChipSpec {
  if (o.type === 'NEEDS_REVIEW') {
    return chip('serious', 'chip.rule.needsReview');
  }
  return o.severity === 'HIGH' ? chip('critical', 'chip.rule.alertHigh') : chip('warning', 'chip.rule.alertMedium');
}

export interface TimelineTone { tone: Tone; glyph: string; icon: IconName | null }

export function timelineTone(item: Pick<TimelineItem, 'category' | 'kind' | 'severity'>): TimelineTone {
  switch (item.category) {
    case 'NOTE': return { tone: 'neutral', glyph: '', icon: 'edit' };
    case 'CHECK_IN': return { tone: 'good', glyph: GLYPH.good, icon: null };
    case 'ALERT':
      if (item.kind === 'ALERT_CREATED') {
        return item.severity === 'HIGH' ? { tone: 'critical', glyph: GLYPH.critical, icon: null } : { tone: 'warning', glyph: GLYPH.warning, icon: null };
      }
      return { tone: 'info', glyph: GLYPH.info, icon: null };
    case 'APPOINTMENT': return { tone: 'info', glyph: GLYPH.info, icon: null };
    case 'FOLLOW_UP': return { tone: 'good', glyph: GLYPH.good, icon: null };
    case 'DOCUMENT': return { tone: 'neutral', glyph: '', icon: 'file' };
    default: return { tone: 'info', glyph: '', icon: 'message' };
  }
}
