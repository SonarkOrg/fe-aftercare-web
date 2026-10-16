import { AlertSeverity, AlertStatus } from '../models/alert.model';
import { AppointmentStatus } from '../models/appointment.model';
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
