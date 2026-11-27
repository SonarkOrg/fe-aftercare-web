import { normalizeText } from '../patients/patients.component';
import { extractNam } from '../../shared/ramq.util';

/** What the local filter needs from a desk row's patient. Never a NAM. */
export interface DeskSearchable { firstName: string; lastName: string; dateOfBirth: string | null }

const SEPARATORS = /[\s,\-'’‑–]+/;

/** Upper-case, accent-free tokens of a text; the whole tokens ST and STE become SAINT and SAINTE. */
export function nameTokens(text: string): string[] {
  return normalizeText(text ?? '').toUpperCase().split(SEPARATORS).filter(Boolean).map(expandSaint);
}

function expandSaint(t: string): string {
  return t === 'ST' ? 'SAINT' : t === 'STE' ? 'SAINTE' : t;
}

/** Parts of a name (`GAGNON`, `TREMBLAY`) plus the form joined without separators (`GAGNONTREMBLAY`). */
export function nameParts(name: string): string[] {
  const parts = nameTokens(name);
  return parts.length > 1 ? [...parts, parts.join('')] : parts;
}

function realDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 1000 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

/** `AAAA-MM-JJ`, `JJ/MM/AAAA`, `JJ-MM-AAAA` or `JJMMAAAA` (a real date, not after `today`) as YYYY-MM-DD; two-digit years are not accepted. */
export function parseBirthDate(text: string, today: string): string | null {
  const t = (text ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  let iso: string | null = null;
  if (m) {
    iso = realDate(+m[1], +m[2], +m[3]);
  } else if ((m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(t)) || (m = /^(\d{2})(\d{2})(\d{4})$/.exec(t))) {
    iso = realDate(+m[3], +m[2], +m[1]);
  }
  return iso && iso <= today ? iso : null;
}

/** True when the text could be (the start of) a health number: never echoed, never put in a link. */
export function maybeNam(text: string): boolean {
  // any separator between the digits ("TREM 68 54", "TREM.6854") still counts: never echo or link a partial card number
  return extractNam(text) !== null || /[A-Za-z]{4}(?:[\s.\-\/_]?\d){3,}/.test(text ?? '');
}

/** Every token of the query is a prefix of at least one part (or joined form) of the first or last name. */
export function matchesName(p: DeskSearchable, query: string): boolean {
  const raw = normalizeText(query ?? '').toUpperCase().split(SEPARATORS).filter(Boolean);
  if (!raw.length) {
    return true;
  }
  const parts = [...nameParts(p.firstName), ...nameParts(p.lastName)];
  // "st" is tried both as SAINT and as the typed letters, so "Stéphane" is still found while typing
  return raw.every(t => [t, expandSaint(t)].some(alt => parts.some(part => part.startsWith(alt))));
}

/** Local filter: a date of birth in one of the accepted forms matches by equality, anything else by name. */
export function matchesRow(p: DeskSearchable, query: string, today: string): boolean {
  if (!(query ?? '').trim()) {
    return true;
  }
  const dob = parseBirthDate(query, today);
  if (dob) {
    return p.dateOfBirth === dob;
  }
  return matchesName(p, query);
}
