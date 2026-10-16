import { Alert } from '../models/alert.model';

/** A MISSED_CHECKIN alert has no question, answer or check-in: it is about a day without one. */
export function isMissed(a: Pick<Alert, 'type'>): boolean {
  return a.type === 'MISSED_CHECKIN';
}

/** The "Question" cell: the question, or "Missed check-in". */
export function alertLabel(a: Alert): string {
  return isMissed(a) ? 'Missed check-in' : a.questionLabel ?? '';
}

/** The "Answer" cell: Yes/No/value, or "—" when there is none. */
export function alertAnswer(a: Alert): string {
  if (isMissed(a) || a.answerValue === null || a.answerValue === undefined) {
    return '—';
  }
  return a.answerValue === 'true' ? 'Yes' : a.answerValue === 'false' ? 'No' : a.answerValue;
}

/** The day the alert is about: the check-in day, or the missed day. */
export function alertDay(a: Alert): string | null {
  return isMissed(a) ? a.missedDate : a.checkInDate;
}
