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
