import { AlertSeverity, AlertStatus } from '../models/alert.model';
import { AppointmentStatus } from '../models/appointment.model';
import { AllergySeverity } from '../models/medical.model';
import { TimelineItem } from '../models/timeline.model';
import { PatientStatus } from './care.model';
import { IconName } from './icon/icon.component';
import { fmtDayShort } from './messages.util';

export type Tone = 'critical' | 'serious' | 'warning' | 'good' | 'info' | 'neutral';
/** `short` is a compact word for narrow cards; `label` stays the long, spoken form. */
export interface ChipSpec { tone: Tone; glyph: string; label: string; short?: string }

export const GLYPH: Record<Tone, string> = { critical: '▲', serious: '◆', warning: '●', good: '✓', info: 'ℹ', neutral: '—' };

function chip(tone: Tone, label: string, glyph: string = GLYPH[tone], short?: string): ChipSpec {
  return short ? { tone, glyph, label, short } : { tone, glyph, label };
}

export function patientStatusChip(s: PatientStatus): ChipSpec {
  switch (s) {
    case 'CRITICAL': return chip('critical', 'Critical');
    case 'ATTENTION': return chip('warning', 'Needs attention');
    case 'STABLE': return chip('good', 'Stable');
    default: return chip('neutral', 'Inactive');
  }
}

export function severityChip(s: AlertSeverity): ChipSpec {
  return s === 'HIGH' ? chip('critical', 'High') : chip('warning', 'Medium');
}

export function alertStatusChip(s: AlertStatus): ChipSpec {
  switch (s) {
    case 'OPEN': return chip('serious', 'Open');
    case 'ACKNOWLEDGED': return chip('info', 'Acknowledged');
    default: return chip('good', 'Resolved');
  }
}

export function appointmentChip(a: { status: AppointmentStatus; questionnaireMissing: boolean }): ChipSpec {
  switch (a.status) {
    case 'NEEDS_REVIEW': return chip('serious', 'Needs review', undefined, 'Review');
    case 'READY': return chip('good', 'Ready');
    case 'COMPLETED': return chip('neutral', 'Completed', '✓');
    case 'CANCELLED': return chip('neutral', 'Cancelled', '✕');
    case 'NO_SHOW': return chip('neutral', 'No-show', '⊘');
    default:
      return a.questionnaireMissing ? chip('warning', 'Questionnaire missing', undefined, 'No form') : chip('info', 'Awaiting questionnaire');
  }
}

export function allergyChip(s: AllergySeverity): ChipSpec {
  switch (s) {
    case 'SEVERE': return chip('critical', 'Severe');
    case 'MODERATE': return chip('serious', 'Moderate');
    case 'MILD': return chip('warning', 'Mild');
    default: return chip('neutral', 'Unknown');
  }
}

export function staffActiveChip(active: boolean): ChipSpec {
  return active ? chip('good', 'Active') : chip('neutral', 'Inactive', '⊘');
}

export function linkedChip(linked: boolean): ChipSpec {
  return linked ? chip('info', 'Linked') : chip('neutral', 'Not linked');
}

/** `until` is exclusive (Toronto midnight after the last open day), so the label names the day before. */
export function messagingChip(open: boolean, until: string | null): ChipSpec {
  return open ? chip('good', until ? `Open through ${fmtDayShort(new Date(Date.parse(until) - 1).toISOString())}` : 'Open') : chip('neutral', 'Closed', '⊘');
}

export function ruleOutcomeChip(o: { type: 'ALERT' | 'NEEDS_REVIEW'; severity?: 'HIGH' | 'MEDIUM' }): ChipSpec {
  if (o.type === 'NEEDS_REVIEW') {
    return chip('serious', 'Needs review');
  }
  return o.severity === 'HIGH' ? chip('critical', 'Alert · High') : chip('warning', 'Alert · Medium');
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
