import { appointmentChip, alertStatusChip, allergyChip, linkedChip, messagingChip, patientStatusChip, ruleOutcomeChip, severityChip, staffActiveChip, timelineTone } from './status';

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

  it('allergy severities', () => {
    expect(allergyChip('SEVERE')).toEqual({ tone: 'critical', glyph: '▲', label: 'Severe' });
    expect(allergyChip('MODERATE')).toEqual({ tone: 'serious', glyph: '◆', label: 'Moderate' });
    expect(allergyChip('MILD')).toEqual({ tone: 'warning', glyph: '●', label: 'Mild' });
    expect(allergyChip('UNKNOWN')).toEqual({ tone: 'neutral', glyph: '—', label: 'Unknown' });
  });
  it('staff active, linked and messaging chips', () => {
    expect(staffActiveChip(false)).toEqual({ tone: 'neutral', glyph: '⊘', label: 'Inactive' });
    expect(linkedChip(true)).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Linked' });
    expect(linkedChip(false)).toEqual({ tone: 'neutral', glyph: '—', label: 'Not linked' });
    expect(messagingChip(false, null)).toEqual({ tone: 'neutral', glyph: '⊘', label: 'Closed' });
    const open = messagingChip(true, '2026-10-20T04:00:00Z');
    expect(open.tone).toBe('good');
    expect(open.glyph).toBe('✓');
    expect(open.label).toBe('Open through 19 Oct');
  });
  it('rule outcomes', () => {
    expect(ruleOutcomeChip({ type: 'ALERT', severity: 'HIGH' })).toEqual({ tone: 'critical', glyph: '▲', label: 'Alert · High' });
    expect(ruleOutcomeChip({ type: 'ALERT', severity: 'MEDIUM' })).toEqual({ tone: 'warning', glyph: '●', label: 'Alert · Medium' });
    expect(ruleOutcomeChip({ type: 'NEEDS_REVIEW' })).toEqual({ tone: 'serious', glyph: '◆', label: 'Needs review' });
  });
  it('every new status chip has a glyph and a word', () => {
    const all = [
      ...(['SEVERE', 'MODERATE', 'MILD', 'UNKNOWN'] as const).map(allergyChip), staffActiveChip(false), staffActiveChip(true),
      linkedChip(true), linkedChip(false), messagingChip(true, null), messagingChip(false, null),
      ruleOutcomeChip({ type: 'ALERT', severity: 'HIGH' }), ruleOutcomeChip({ type: 'ALERT', severity: 'MEDIUM' }), ruleOutcomeChip({ type: 'NEEDS_REVIEW' })
    ];
    for (const c of all) {
      expect(c.glyph.length).withContext(c.label).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
  it('timeline tones', () => {
    const t = (category: any, kind: any = 'X', severity: any = null) => timelineTone({ category, kind, severity });
    expect(t('NOTE')).toEqual({ tone: 'neutral', glyph: '', icon: 'edit' });
    expect(t('CHECK_IN')).toEqual({ tone: 'good', glyph: '✓', icon: null });
    expect(t('ALERT', 'ALERT_CREATED', 'HIGH')).toEqual({ tone: 'critical', glyph: '▲', icon: null });
    expect(t('ALERT', 'ALERT_CREATED', 'MEDIUM')).toEqual({ tone: 'warning', glyph: '●', icon: null });
    expect(t('ALERT', 'ALERT_ACKNOWLEDGED', 'HIGH')).toEqual({ tone: 'info', glyph: 'ℹ', icon: null });
    expect(t('ALERT', 'ALERT_RESOLVED')).toEqual({ tone: 'info', glyph: 'ℹ', icon: null });
    expect(t('APPOINTMENT')).toEqual({ tone: 'info', glyph: 'ℹ', icon: null });
    expect(t('FOLLOW_UP')).toEqual({ tone: 'good', glyph: '✓', icon: null });
    expect(t('DOCUMENT')).toEqual({ tone: 'neutral', glyph: '', icon: 'file' });
    expect(t('MESSAGE')).toEqual({ tone: 'info', glyph: '', icon: 'message' });
  });
});
