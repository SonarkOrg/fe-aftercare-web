import { testT } from '../testing/i18n-testing.module';
import { ChipSpec, appointmentChip, arrivalChip, cardChip, cardNoteChip, deskChip, reasonChip, alertStatusChip, allergyChip, linkedChip, messagingChip, patientStatusChip, ruleOutcomeChip, severityChip, staffActiveChip, timelineTone } from './status';

const t = testT('en');
/** The chip with its message keys turned into English text. */
const text = (c: ChipSpec): any => ({ ...c, label: t(c.label.key, c.label.params), ...(c.short ? { short: t(c.short.key) } : {}) });

describe('status chip mappings', () => {
  it('patient status', () => {
    expect(text(patientStatusChip('CRITICAL'))).toEqual({ tone: 'critical', glyph: '▲', label: 'Critical' });
    expect(text(patientStatusChip('ATTENTION'))).toEqual({ tone: 'warning', glyph: '●', label: 'Needs attention' });
    expect(text(patientStatusChip('STABLE'))).toEqual({ tone: 'good', glyph: '✓', label: 'Stable' });
    expect(text(patientStatusChip('INACTIVE'))).toEqual({ tone: 'neutral', glyph: '—', label: 'Inactive' });
  });
  it('severity', () => {
    expect(text(severityChip('HIGH'))).toEqual({ tone: 'critical', glyph: '▲', label: 'High' });
    expect(text(severityChip('MEDIUM'))).toEqual({ tone: 'warning', glyph: '●', label: 'Medium' });
  });
  it('alert status', () => {
    expect(text(alertStatusChip('OPEN'))).toEqual({ tone: 'serious', glyph: '◆', label: 'Open' });
    expect(text(alertStatusChip('ACKNOWLEDGED'))).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Acknowledged' });
    expect(text(alertStatusChip('RESOLVED'))).toEqual({ tone: 'good', glyph: '✓', label: 'Resolved' });
  });
  it('appointments (all 7 cases)', () => {
    const c = (status: any, questionnaireMissing = false) => appointmentChip({ status, questionnaireMissing });
    expect(text(c('NEEDS_REVIEW'))).toEqual({ tone: 'serious', glyph: '◆', label: 'Needs review', short: 'Review' });
    expect(text(c('SCHEDULED', true))).toEqual({ tone: 'warning', glyph: '●', label: 'Questionnaire missing', short: 'No form' });
    expect(text(c('SCHEDULED'))).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Awaiting questionnaire' });
    expect(text(c('READY'))).toEqual({ tone: 'good', glyph: '✓', label: 'Ready' });
    expect(text(c('COMPLETED'))).toEqual({ tone: 'neutral', glyph: '✓', label: 'Completed' });
    expect(text(c('CANCELLED'))).toEqual({ tone: 'neutral', glyph: '✕', label: 'Cancelled' });
    expect(text(c('NO_SHOW'))).toEqual({ tone: 'neutral', glyph: '⊘', label: 'No-show' });
  });

  it('allergy severities', () => {
    expect(text(allergyChip('SEVERE'))).toEqual({ tone: 'critical', glyph: '▲', label: 'Severe' });
    expect(text(allergyChip('MODERATE'))).toEqual({ tone: 'serious', glyph: '◆', label: 'Moderate' });
    expect(text(allergyChip('MILD'))).toEqual({ tone: 'warning', glyph: '●', label: 'Mild' });
    expect(text(allergyChip('UNKNOWN'))).toEqual({ tone: 'neutral', glyph: '—', label: 'Unknown' });
  });
  it('staff active, linked and messaging chips', () => {
    expect(text(staffActiveChip(false))).toEqual({ tone: 'neutral', glyph: '⊘', label: 'Inactive' });
    expect(text(linkedChip(true))).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Linked' });
    expect(text(linkedChip(false))).toEqual({ tone: 'neutral', glyph: '—', label: 'Not linked' });
    expect(text(messagingChip(false, null))).toEqual({ tone: 'neutral', glyph: '⊘', label: 'Closed' });
    const open = text(messagingChip(true, '2026-10-20T04:00:00Z'));
    expect(open.tone).toBe('good');
    expect(open.glyph).toBe('✓');
    expect(open.label).toBe('Open through 19 Oct');
  });
  it('rule outcomes', () => {
    expect(text(ruleOutcomeChip({ type: 'ALERT', severity: 'HIGH' }))).toEqual({ tone: 'critical', glyph: '▲', label: 'Alert · High' });
    expect(text(ruleOutcomeChip({ type: 'ALERT', severity: 'MEDIUM' }))).toEqual({ tone: 'warning', glyph: '●', label: 'Alert · Medium' });
    expect(text(ruleOutcomeChip({ type: 'NEEDS_REVIEW' }))).toEqual({ tone: 'serious', glyph: '◆', label: 'Needs review' });
  });
  it('every new status chip has a glyph and a word', () => {
    const all = [
      ...(['SEVERE', 'MODERATE', 'MILD', 'UNKNOWN'] as const).map(allergyChip), staffActiveChip(false), staffActiveChip(true),
      linkedChip(true), linkedChip(false), messagingChip(true, null), messagingChip(false, null),
      ruleOutcomeChip({ type: 'ALERT', severity: 'HIGH' }), ruleOutcomeChip({ type: 'ALERT', severity: 'MEDIUM' }), ruleOutcomeChip({ type: 'NEEDS_REVIEW' })
    ];
    for (const c of all) {
      expect(c.glyph.length).withContext(c.label.key).toBeGreaterThan(0);
      expect(t(c.label.key, c.label.params).length).toBeGreaterThan(0);
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
  it('desk states are glyph + word, never colour alone', () => {
    expect(text(deskChip('GO'))).toEqual({ tone: 'good', glyph: '✓', label: 'Ready' });
    expect(text(deskChip('CHECK'))).toEqual({ tone: 'warning', glyph: '●', label: 'To check' });
    expect(text(deskChip('ARRIVED'))).toEqual({ tone: 'good', glyph: '✓', label: 'Here' });
    expect(text(deskChip('CLOSED'))).toEqual({ tone: 'neutral', glyph: '—', label: 'Closed' });
  });
  it('desk reasons and notices; an unknown code is not rendered', () => {
    expect(text(reasonChip('QUESTIONNAIRE_MISSING')!)).toEqual({ tone: 'warning', glyph: '●', label: 'Questionnaire missing' });
    expect(text(reasonChip('CONTACT_MISSING')!)).toEqual({ tone: 'warning', glyph: '●', label: 'No contact details' });
    expect(text(reasonChip('DOB_MISSING')!)).toEqual({ tone: 'warning', glyph: '●', label: 'Date of birth missing' });
    expect(text(reasonChip('CONSENT_UNKNOWN')!)).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Consent not answered' });
    expect(reasonChip('SOMETHING_NEW')).toBeNull();
    expect(reasonChip('')).toBeNull();
  });
  it('arrival chip only when arrived', () => {
    for (const status of ['SCHEDULED', 'READY', 'NEEDS_REVIEW'] as const) {
      expect(text(arrivalChip({ arrivedAt: '2026-10-14T13:02:00Z', status })!)).withContext(status).toEqual({ tone: 'good', glyph: '✓', label: 'Here' });
    }
    expect(arrivalChip({ arrivedAt: null, status: 'READY' })).toBeNull();
    // on a closed appointment the arrival is history, not a chip
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(arrivalChip({ arrivedAt: '2026-10-14T13:02:00Z', status })).withContext(status).toBeNull();
    }
  });
  it('card reasons and notices (phase 1B)', () => {
    expect(text(reasonChip('CARD_EXPIRED')!)).toEqual({ tone: 'critical', glyph: '▲', label: 'Card expired' });
    expect(text(reasonChip('CARD_EXPIRING')!)).toEqual({ tone: 'warning', glyph: '●', label: 'Card expiring soon' });
    expect(text(reasonChip('CARD_NOT_ON_FILE')!)).toEqual({ tone: 'neutral', glyph: '—', label: 'No card on file' });
    expect(text(reasonChip('CARD_EXPIRY_UNKNOWN')!)).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Card expiry unknown' });
    expect(text(reasonChip('POSSIBLE_DUPLICATE')!)).toEqual({ tone: 'neutral', glyph: '—', label: 'Possible duplicate flagged' });
  });
  it('card chip per status', () => {
    expect(text(cardChip({ status: 'OK' }))).toEqual({ tone: 'good', glyph: '✓', label: 'Card on file' });
    expect(text(cardChip({ status: 'EXPIRING' }))).toEqual({ tone: 'warning', glyph: '●', label: 'Card expiring soon' });
    expect(text(cardChip({ status: 'EXPIRED' }))).toEqual({ tone: 'critical', glyph: '▲', label: 'Card expired' });
    expect(text(cardChip({ status: 'UNKNOWN' }))).toEqual({ tone: 'info', glyph: 'ℹ', label: 'Card expiry unknown' });
    expect(text(cardChip({ status: 'NONE' }))).toEqual({ tone: 'neutral', glyph: '—', label: 'No card on file' });
  });
  it('card note chip is neutral', () => {
    expect(text(cardNoteChip('NO_CARD'))).toEqual({ tone: 'neutral', glyph: '—', label: 'No card' });
    expect(text(cardNoteChip('NOT_VALID_TODAY'))).toEqual({ tone: 'neutral', glyph: '—', label: 'Card not valid today' });
  });
});
