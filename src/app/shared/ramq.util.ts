/** RAMQ number rules (same as the API, used for inline validation only; the API is authoritative). */
export function normalizeRamq(v: string | null | undefined): string {
  return (v ?? '').toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRamq(v: string | null | undefined): boolean {
  const n = normalizeRamq(v);
  if (!/^[A-Z]{4}\d{8}$/.test(n)) {
    return false;
  }
  const month = Number(n.slice(6, 8)); // digits 3-4 of the 8 digits
  const day = Number(n.slice(8, 10)); // digits 5-6
  return ((month >= 1 && month <= 12) || (month >= 51 && month <= 62)) && day >= 1 && day <= 31;
}

/** "TREM68541212" -> "TREM 6854 1212" (anything that is not 12 characters is returned as is). */
export function formatRamq(v: string): string {
  const n = normalizeRamq(v);
  return n.length === 12 ? `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}` : v;
}

/**
 * The first substring of a scan or typed text that looks like a NAM and passes the structure check, or null.
 * A scan is assumed to give the NAM only; any longer payload is read in memory and the rest is discarded (spec 3.1.11).
 */
export function extractNam(raw: string): string | null {
  const text = (raw ?? '').toUpperCase();
  // 4 letters then 8 digits, each digit optionally preceded by ONE separator (space, dot, dash, slash, underscore), so a NAM
  // typed in pairs ("TREM 68 54 12 12") or with dots ("TREM.6854.1212") is recognised too.
  // Sticky: tried at every offset in turn so overlapping candidates are not skipped.
  const re = /([A-Z]{4})((?:[\s.\-\/_]?\d){8})/y;
  for (let i = 0; i < text.length; i++) {
    re.lastIndex = i;
    const m = re.exec(text);
    const nam = m ? m[1] + m[2].replace(/\D/g, '') : null;
    if (nam && isValidRamq(nam)) {
      return nam;
    }
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Birth dates a well-formed NAM can stand for, newest first (spec 3.1 / BE `HealthNumbers.birthDates`): digits 1-2 are the
 * year (19YY or 20YY, never in the future), digits 3-4 the month (+50 on the month is only a marker, never read as a sex
 * here), digits 5-6 the day. Empty when the text is not a valid NAM or no candidate is a real date. `todayIso` is `YYYY-MM-DD`.
 */
export function birthDatesFromRamq(nam: string, todayIso: string): string[] {
  const n = normalizeRamq(nam);
  if (!isValidRamq(n)) {
    return [];
  }
  const yy = Number(n.slice(4, 6));
  const month = Number(n.slice(6, 8)) % 50;
  const day = Number(n.slice(8, 10));
  const out: string[] = [];
  for (const century of [2000, 1900]) {
    const y = century + yy;
    if (!isRealDate(y, month, day)) {
      continue;
    }
    const iso = `${y}-${pad2(month)}-${pad2(day)}`;
    if (iso <= todayIso) {
      out.push(iso);
    }
  }
  return out;
}

/**
 * The expiry printed on a health card, typed by a person: MMAA, MM AA, MM-AA, MM/AA, MM-AAAA, MM/AAAA or AAAA-MM
 * (two-digit years are 20YY). Returns "YYYY-MM", or null when the text is not one of those or the month lies outside
 * [today - 24 months, today + 10 years] (so « 1103 », which would be 2003, is refused). `todayIso` is `YYYY-MM-DD`.
 * Only this function knows the printed order: if real cards differ, change it here (spec 11.5, section 29 Q6).
 */
export function parseCardExpiry(text: string, todayIso: string): string | null {
  const t = (text ?? '').trim();
  let year: number;
  let month: number;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{2})$/.exec(t))) {
    year = Number(m[1]);
    month = Number(m[2]);
  } else if ((m = /^(\d{2})[\s\-/](\d{4})$/.exec(t))) {
    month = Number(m[1]);
    year = Number(m[2]);
  } else if ((m = /^(\d{2})(?:[\s\-/]?)(\d{2})$/.exec(t))) {
    month = Number(m[1]);
    year = 2000 + Number(m[2]);
  } else {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  const today = /^(\d{4})-(\d{2})/.exec(todayIso);
  if (!today) {
    return null;
  }
  const idx = year * 12 + (month - 1);
  const now = Number(today[1]) * 12 + (Number(today[2]) - 1);
  if (idx < now - 24 || idx > now + 120) {
    return null;
  }
  return `${year}-${pad2(month)}`;
}

/** "2027-03" -> "03-2027"; anything else is returned as is. */
export function formatCardExpiry(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
  return m ? `${m[2]}-${m[1]}` : ym;
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2027-03" -> « mars 2027 » / "March 2027". Anything that is not YYYY-MM is returned as is. */
export function cardExpiryLabel(ym: string, lang: 'fr' | 'en' | string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
  const month = m ? Number(m[2]) : 0;
  if (!m || month < 1 || month > 12) {
    return ym;
  }
  return `${(lang.toLowerCase().startsWith('fr') ? MONTHS_FR : MONTHS_EN)[month - 1]} ${m[1]}`;
}

/**
 * Client twin of the server's NAM-shaped-text rule (spec 3.1.12, `looksLikeHealthNumber`): 4 letters then 8 digits with
 * optional separators, or anything `extractNam` recognises. Used to refuse such text in name fields; the server is the backstop.
 */
export function looksLikeNam(text: string): boolean {
  const t = text ?? '';
  return /[A-Z]{4}[\s.\-/_]?\d{4}[\s.\-/_]?\d{4}/i.test(t) || extractNam(t) !== null;
}
