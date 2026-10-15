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
