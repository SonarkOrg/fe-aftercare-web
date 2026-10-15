/** Whole years between a YYYY-MM-DD date of birth and today (YYYY-MM-DD); null without a date of birth. */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  if (!dob) {
    return null;
  }
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if ([by, bm, bd, ty, tm, td].some(n => !Number.isFinite(n))) {
    return null;
  }
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) {
    age--;
  }
  return age < 0 ? null : age;
}
