import type { Msg } from '../i18n/i18n.types';

export function buildPatientLink(code: string): string {
  return new URL('q/' + code, document.baseURI).toString();
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** All "today"/"now" decisions are made in the clinic's business time zone, whatever the browser's zone is. */
export const BUSINESS_TZ = 'America/Toronto';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function zoned(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
}

/** Today's calendar date in America/Toronto as YYYY-MM-DD. */
export function businessToday(now: Date = new Date()): string {
  const z = zoned(now);
  return `${z['year']}-${z['month']}-${z['day']}`;
}

/** Calendar date (America/Toronto) of an ISO instant such as "2026-10-13T14:00:00Z". */
export function businessDateOf(iso: string): string {
  return businessToday(new Date(iso));
}

/** Adds days to a YYYY-MM-DD string using pure calendar math. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Monday of the week containing the given YYYY-MM-DD. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

/** "POST_OP_FOLLOWUP" -> "Post op followup" */
export function humanize(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const s = value.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** America/Toronto date-time as YYYY-MM-DDTHH:mm:ss (compared as a string with scheduledAt; never parse scheduledAt as a Date). */
export function businessNow(now: Date = new Date()): string {
  const z = zoned(now);
  return `${z['year']}-${z['month']}-${z['day']}T${z['hour']}:${z['minute']}:${z['second']}`;
}

/** Hour of day (0-23) in America/Toronto. */
export function businessHour(now: Date = new Date()): number {
  return Number(zoned(now)['hour']);
}

/** Whole calendar days from a to b (b - a). Pure calendar math on YYYY-MM-DD strings. */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "Today" | "Yesterday" | "N days ago" | "in N days" (or "Tomorrow"), as a dictionary message. */
export function relativeDay(iso: string, today: string): Msg {
  const n = daysBetween(iso, today);
  if (n === 0) {
    return { key: 'relative.today' };
  }
  if (n === 1) {
    return { key: 'relative.yesterday' };
  }
  if (n === -1) {
    return { key: 'relative.tomorrow' };
  }
  return n > 0 ? { key: 'relative.daysAgo', params: { count: n } } : { key: 'relative.inDays', params: { count: -n } };
}

/** First character of each name, uppercased ("MT"). */
export function initials(first: string, last: string): string {
  return ((first ?? '').trim().charAt(0) + (last ?? '').trim().charAt(0)).toUpperCase();
}
