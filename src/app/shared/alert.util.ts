import { fmtNum } from '../i18n/format';
import { AnyLang, TKey } from '../i18n/i18n.types';
import { Alert } from '../models/alert.model';

/** A MISSED_CHECKIN alert has no question, answer or check-in: it is about a day without one. */
export function isMissed(a: Pick<Alert, 'type'>): boolean {
  return a.type === 'MISSED_CHECKIN';
}

/** The "Answer" cell: Yes/No (translated), a number in the locale's format (38,4), or "—" when there is none. */
export function alertAnswer(a: Pick<Alert, 'type' | 'answerValue'>, lang: AnyLang, t: (key: TKey) => string): string {
  if (isMissed(a) || a.answerValue === null || a.answerValue === undefined) {
    return '—';
  }
  if (a.answerValue === 'true') {
    return t('common.yes');
  }
  if (a.answerValue === 'false') {
    return t('common.no');
  }
  return /^-?\d+(\.\d+)?$/.test(a.answerValue) ? fmtNum(a.answerValue, '1.0-2', lang) : a.answerValue;
}

/** The day the alert is about: the check-in day, or the missed day. */
export function alertDay(a: Alert): string | null {
  return isMissed(a) ? a.missedDate : a.checkInDate;
}
