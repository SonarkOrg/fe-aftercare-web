import { AlertSeverity, AlertStatus } from '../models/alert.model';
import { AppointmentStatus } from '../models/appointment.model';
import { PatientStatus } from './care.model';

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
