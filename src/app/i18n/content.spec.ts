import { alertDto, missedAlert, timelineItem } from '../testing/fixtures';
import { testT } from '../testing/i18n-testing.module';
import { alertMessage, alertQuestion, alertResolutionNote, alertResolvedBy, intakeFlagLabel, intakeFlagMessage, questionnaireTitle, timelineSummary } from './content';

describe('content selection', () => {
  const en = testT('en');
  const fr = testT('fr');

  it('alertMessage picks the language and falls back to the other', () => {
    const a = alertDto();
    expect(alertMessage(a, 'fr')).toBe('Douleur sévère signalée (8/10)');
    expect(alertMessage(a, 'en')).toBe('Severe pain reported (8/10)');
    expect(alertMessage({ message: 'x', messageFr: '' }, 'fr')).toBe('x');
    expect(alertMessage({ message: '', messageFr: 'y' }, 'en')).toBe('y');
  });

  it('alertQuestion: missed check-in, French label, flagged English fallback', () => {
    expect(alertQuestion(missedAlert(), 'fr', fr)).toEqual({ text: 'Suivi quotidien manqué', english: false });
    expect(alertQuestion(alertDto(), 'fr', fr)).toEqual({ text: 'Intensité de la douleur', english: false });
    expect(alertQuestion(alertDto({ questionLabelFr: null }), 'fr', fr)).toEqual({ text: 'Pain level?', english: true });
    expect(alertQuestion(alertDto(), 'en', en)).toEqual({ text: 'Pain level?', english: false });
  });

  it('an automatic resolution has a fixed sentence; a person note is verbatim', () => {
    expect(alertResolutionNote({ resolvedBy: 'system:checkin', resolutionNote: 'x' }, fr)).toBe('Suivi quotidien reçu');
    expect(alertResolutionNote({ resolvedBy: 'Dev Nurse', resolutionNote: 'Called the patient' }, fr)).toBe('Called the patient');
    expect(alertResolvedBy({ resolvedBy: 'system:checkin' }, fr)).toBe('Système');
    expect(alertResolvedBy({ resolvedBy: 'Dev Nurse' }, fr)).toBe('Dev Nurse');
  });

  it('questionnaireTitle falls back to the other language', () => {
    expect(questionnaireTitle({ title: { fr: 'Suivi', en: 'Follow-up' } }, 'fr')).toBe('Suivi');
    expect(questionnaireTitle({ title: { fr: '', en: 'Follow-up' } }, 'fr')).toBe('Follow-up');
    expect(questionnaireTitle({ title: { fr: 'Suivi', en: '' } }, 'en')).toBe('Suivi');
  });

  it('intake flags', () => {
    const f = { label: 'Fever?', labelFr: 'Fièvre?', message: 'Recent fever', messageFr: 'Fièvre récente' };
    expect(intakeFlagLabel(f, 'fr')).toBe('Fièvre?');
    expect(intakeFlagLabel({ ...f, labelFr: null }, 'fr')).toBe('Fever?');
    expect(intakeFlagMessage(f, 'fr')).toBe('Fièvre récente');
    expect(intakeFlagMessage(f, 'en')).toBe('Recent fever');
  });

  it('timeline summary: French when present, else the English text, flagged', () => {
    expect(timelineSummary(timelineItem(), 'fr')).toEqual({ text: 'Suivi quotidien reçu pour le 2026-10-14', english: false });
    expect(timelineSummary(timelineItem({ summaryFr: null }), 'fr')).toEqual({ text: 'Check-in submitted for 2026-10-14', english: true });
    expect(timelineSummary(timelineItem(), 'en').english).toBeFalse();
  });
});
