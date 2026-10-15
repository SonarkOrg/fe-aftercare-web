import { appointmentChip, alertStatusChip, patientStatusChip, severityChip } from './status';

describe('status chip mappings', () => {
  it('patient status', () => {
    expect(patientStatusChip('CRITICAL')).toEqual({ tone: 'critical', glyph: '▲', label: 'Critical' });
    expect(patientStatusChip('ATTENTION')).toEqual({ tone: 'warning', glyph: '●', label: 'Needs attention' });
    expect(patientStatusChip('STABLE')).toEqual({ tone: 'good', glyph: '✓', label: 'Stable' });
    expect(patientStatusChip('INACTIVE')).toEqual({ tone: 'neutral', glyph: '—', label: 'Inactive' });
  });
  it('severity', () => {
    expect(severityChip('HIGH')).toEqual({ tone: 'critical', glyph: '▲', label: 'High' });
    expect(severityChip('MEDIUM')).toEqual({ tone: 'warning', glyph: '●', label: 'Medium' });
  });
  it('alert status', () => {
    expect(alertStatusChip('OPEN')).toEqual({ tone: 'serious', glyph: '◆', label: 'Open' });
    expect(alertStatusChip('ACKNOWLEDGED')).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Acknowledged' });
    expect(alertStatusChip('RESOLVED')).toEqual({ tone: 'good', glyph: '✓', label: 'Resolved' });
  });
  it('appointments (all 7 cases)', () => {
    const c = (status: any, questionnaireMissing = false) => appointmentChip({ status, questionnaireMissing });
    expect(c('NEEDS_REVIEW')).toEqual({ tone: 'serious', glyph: '◆', label: 'Needs review', short: 'Review' });
    expect(c('SCHEDULED', true)).toEqual({ tone: 'warning', glyph: '●', label: 'Questionnaire missing', short: 'No form' });
    expect(c('SCHEDULED')).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Awaiting questionnaire' });
    expect(c('READY')).toEqual({ tone: 'good', glyph: '✓', label: 'Ready' });
    expect(c('COMPLETED')).toEqual({ tone: 'neutral', glyph: '✓', label: 'Completed' });
    expect(c('CANCELLED')).toEqual({ tone: 'neutral', glyph: '✕', label: 'Cancelled' });
    expect(c('NO_SHOW')).toEqual({ tone: 'neutral', glyph: '⊘', label: 'No-show' });
  });
});
