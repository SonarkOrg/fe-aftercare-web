export function buildPatientLink(code: string): string {
  return new URL('q/' + code, document.baseURI).toString();
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** Today's date from the browser's local fields (never toISOString, which is UTC). */
export function todayLocalIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
