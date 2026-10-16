import { fmtDate } from '../i18n/format';
import type { AnyLang } from '../i18n/i18n.types';
import { businessDateOf } from './link.util';

export type MsgLang = AnyLang;

/** Time of day in America/Toronto, e.g. "14:30" (en) or "14 h 30" (fr). */
export function fmtTime(iso: string, lang: MsgLang): string {
  return fmtDate(iso, 'time', lang);
}

/** "Wednesday 14 October" (en) / "mercredi 14 octobre" (fr), in America/Toronto. */
export function fmtDayLong(iso: string, lang: MsgLang): string {
  return fmtDate(iso, 'dayLong', lang);
}

/** "14 Oct" in America/Toronto. */
export function fmtDayShort(iso: string, lang: MsgLang = 'en'): string {
  return fmtDate(iso, 'dateShort', lang);
}

/** "14 Oct 2026" in America/Toronto. */
export function fmtDayYear(iso: string, lang: MsgLang = 'en'): string {
  return fmtDate(iso, 'date', lang);
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
