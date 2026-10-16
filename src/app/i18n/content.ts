import { Alert } from '../models/alert.model';
import { IntakeFlag } from '../models/appointment.model';
import { LocalizedText } from '../models/questionnaire-definition.model';
import { TimelineItem } from '../models/timeline.model';
import { isMissed } from '../shared/alert.util';
import { AnyLang, TKey } from './i18n.types';

type T = (key: TKey) => string;
const isFr = (lang: AnyLang) => lang === 'fr';

/** Text that may fall back to English inside a French page: the template wraps it in lang="en". */
export interface Localized { text: string; english: boolean }

/** The alert message in the current language, falling back to the other one. */
export function alertMessage(a: Pick<Alert, 'message' | 'messageFr'>, lang: AnyLang): string {
  return isFr(lang) ? a.messageFr || a.message : a.message || a.messageFr;
}

/** The "Question" cell: "Missed check-in", or the question label (French when the server sent it). */
export function alertQuestion(a: Pick<Alert, 'type' | 'questionLabel' | 'questionLabelFr'>, lang: AnyLang, t: T): Localized {
  if (isMissed(a)) {
    return { text: t('alert.missedCheckIn'), english: false };
  }
  if (isFr(lang)) {
    const fr = a.questionLabelFr;
    return fr ? { text: fr, english: false } : { text: a.questionLabel ?? '', english: !!a.questionLabel };
  }
  return { text: a.questionLabel ?? '', english: false };
}

/** An automatic resolution is shown with a fixed sentence; a person's note is shown verbatim. */
export function alertResolutionNote(a: Pick<Alert, 'resolvedBy' | 'resolutionNote'>, t: T): string | null {
  if (a.resolvedBy === 'system:checkin') {
    return t('alert.autoResolvedNote');
  }
  return a.resolutionNote;
}

export function alertResolvedBy(a: Pick<Alert, 'resolvedBy'>, t: T): string | null {
  if (!a.resolvedBy) {
    return null;
  }
  return a.resolvedBy.startsWith('system:') ? t('alert.bySystem') : a.resolvedBy;
}

export function questionnaireTitle(d: { title: LocalizedText }, lang: AnyLang): string {
  const other = isFr(lang) ? 'en' : 'fr';
  return d.title[isFr(lang) ? 'fr' : 'en'] || d.title[other];
}

export function intakeFlagLabel(f: Pick<IntakeFlag, 'label' | 'labelFr'>, lang: AnyLang): string {
  return isFr(lang) ? f.labelFr ?? f.label : f.label;
}

export function intakeFlagMessage(f: Pick<IntakeFlag, 'message' | 'messageFr'>, lang: AnyLang): string {
  return isFr(lang) ? f.messageFr || f.message : f.message;
}

/** Timeline summary: French when the row has one, else the English text (marked, for rows written before V6). */
export function timelineSummary(i: Pick<TimelineItem, 'summary' | 'summaryFr'>, lang: AnyLang): Localized {
  if (isFr(lang)) {
    return i.summaryFr ? { text: i.summaryFr, english: false } : { text: i.summary, english: true };
  }
  return { text: i.summary, english: false };
}
