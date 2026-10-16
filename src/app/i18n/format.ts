import { formatDate, formatNumber, formatPercent } from '@angular/common';
import { BUSINESS_TZ } from '../shared/link.util';
import { DATE_PATTERNS, DatePreset } from './date-presets';
import { AnyLang, LOCALE, Lang } from './i18n.types';

export const NBSP = ' ';
const DASH = '—';

const offsetFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, timeZoneName: 'longOffset' });

/** Toronto UTC offset of an instant as '-0400' / '-0500' (correct across daylight saving time). */
export function torontoOffset(date: Date): string {
  const name = offsetFmt.formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : '+0000';
}

const baseLang = (lang: AnyLang): Lang => (lang === 'fr' ? 'fr' : 'en');

/**
 * Formats an ISO instant ('...Z') in America/Toronto, or a YYYY-MM-DD calendar date as-is (never time-zone shifted).
 * Null or empty gives an em dash.
 */
export function fmtDate(value: string | Date | null | undefined, preset: DatePreset, lang: AnyLang): string {
  if (value === null || value === undefined || value === '') {
    return DASH;
  }
  const clockFr = baseLang(lang) === 'fr' && (preset === 'time' || preset === 'dateTime');
  const pattern = clockFr ? (preset === 'time' ? 'HH:mm' : "d MMM '@' HH:mm") : DATE_PATTERNS[baseLang(lang)][preset];
  const locale = LOCALE[lang];
  // French clock times go through fmtClock: "8 h", "14 h 05", with non-breaking spaces; "à" joins date and time.
  const post = (text: string): string => clockFr
    ? text.replace(/(\d{1,2}:\d{2})$/, (_m, hhmm: string) => fmtClock(hhmm, lang)).replace(' @ ', `${NBSP}à${NBSP}`)
    : text;
  try {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return post(formatDate(new Date(Date.UTC(y, m - 1, d)), pattern, locale, '+0000'));
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return typeof value === 'string' ? value : DASH;
    }
    return post(formatDate(date, pattern, locale, torontoOffset(date)));
  } catch {
    return typeof value === 'string' ? value : DASH;
  }
}

/** Locale number. A numeric string is accepted; any other string comes back unchanged. */
export function fmtNum(value: number | string | null | undefined, digits: string, lang: AnyLang): string {
  if (value === null || value === undefined || value === '') {
    return DASH;
  }
  const n = typeof value === 'number' ? value : /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  if (Number.isNaN(n)) {
    return String(value);
  }
  return formatNumber(n, LOCALE[lang], digits);
}

/** 0.825 -> "83 %" (fr, NBSP) / "83%" (en). */
export function fmtPct(rate: number | null | undefined, lang: AnyLang): string {
  return rate === null || rate === undefined ? DASH : formatPercent(rate, LOCALE[lang], '1.0-0');
}

/** 850 -> "850 o"/"850 B"; 1.2 MB -> "1,2 Mo" / "1.2 MB". */
export function fmtFileSize(bytes: number, lang: AnyLang): string {
  const fr = baseLang(lang) === 'fr';
  const num = (v: number, d: string) => formatNumber(v, LOCALE[lang], d);
  if (bytes < 1024) {
    return `${bytes}${NBSP}${fr ? 'o' : 'B'}`;
  }
  if (bytes < 1024 * 1024) {
    return `${num(Math.round(bytes / 1024), '1.0-0')}${NBSP}${fr ? 'ko' : 'KB'}`;
  }
  return `${num(Math.round((bytes / (1024 * 1024)) * 10) / 10, '1.1-1')}${NBSP}${fr ? 'Mo' : 'MB'}`;
}

/** Minutes: "45 min", "2 h 05" in both languages. A negative duration is bad data and shows a dash. */
export function fmtDuration(m: number | null | undefined): string {
  if (m === null || m === undefined || m < 0) {
    return DASH;
  }
  const total = Math.round(m);
  if (total < 60) {
    return `${total}${NBSP}min`;
  }
  const mm = total % 60;
  return `${Math.floor(total / 60)}${NBSP}h${NBSP}${mm < 10 ? '0' + mm : mm}`;
}

const listCache = new Map<string, Intl.ListFormat>();

/** "a, b and c" / « a, b et c ». */
export function fmtList(items: string[], lang: AnyLang): string {
  const locale = LOCALE[lang];
  let f = listCache.get(locale);
  if (!f) {
    f = new Intl.ListFormat(locale, { type: 'conjunction' });
    listCache.set(locale, f);
  }
  return f.format(items);
}

/** Collation shared with the backend: accent-insensitive, French rules in both languages. */
export const collate = (a: string, b: string): number => a.localeCompare(b, 'fr-CA', { sensitivity: 'base' });

/** A wall-clock "HH:mm" (clinic local time, never shifted): "14:05" in English, "14 h 05" in French; "8 h" on the hour. */
export function fmtClock(hhmm: string | null | undefined, lang: AnyLang): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) {
    return hhmm ?? DASH;
  }
  if (baseLang(lang) === 'en') {
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  return m[2] === '00' ? `${Number(m[1])}${NBSP}h` : `${Number(m[1])}${NBSP}h${NBSP}${m[2]}`;
}
