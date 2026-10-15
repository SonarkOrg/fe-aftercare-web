import { BUSINESS_TZ, businessDateOf } from './link.util';

export type MsgLang = 'fr' | 'en';

const locale = (lang: MsgLang) => (lang === 'fr' ? 'fr-CA' : 'en-CA');

/** Time of day in America/Toronto, e.g. "14:30" (en) or "14 h 30" (fr). */
export function fmtTime(iso: string, lang: MsgLang): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

function parts(iso: string, lang: MsgLang, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-GB', { timeZone: BUSINESS_TZ, ...opts }).formatToParts(new Date(iso))) {
    out[p.type] = p.value;
  }
  return out;
}

/** "Wednesday 14 October" (en) / "mercredi 14 octobre" (fr), in America/Toronto. */
export function fmtDayLong(iso: string, lang: MsgLang): string {
  const p = parts(iso, lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p['weekday']} ${p['day']} ${p['month']}`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthShort(iso: string, lang: MsgLang): string {
  if (lang === 'en') {
    return MONTHS_EN[Number(parts(iso, lang, { month: 'numeric' })['month']) - 1];
  }
  return parts(iso, lang, { month: 'short' })['month'];
}

/** "14 Oct" in America/Toronto. */
export function fmtDayShort(iso: string, lang: MsgLang = 'en'): string {
  return `${parts(iso, lang, { day: 'numeric' })['day']} ${monthShort(iso, lang)}`;
}

/** "14 Oct 2026" in America/Toronto. */
export function fmtDayYear(iso: string, lang: MsgLang = 'en'): string {
  return `${fmtDayShort(iso, lang)} ${parts(iso, lang, { year: 'numeric' })['year']}`;
}

export interface DayGroup<T> { day: string; label: string; items: T[] }

/** Groups items (already in display order) under their America/Toronto calendar day. */
export function groupByDay<T>(items: T[], lang: MsgLang, at: (item: T) => string = (i: any) => i.sentAt): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const iso = at(item);
    const day = businessDateOf(iso);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, label: fmtDayLong(iso, lang), items: [item] });
    }
  }
  return groups;
}
