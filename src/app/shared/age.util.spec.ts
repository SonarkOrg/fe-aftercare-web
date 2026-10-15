import { ageOn } from './age.util';

describe('ageOn', () => {
  it('counts the birthday on the day itself', () => {
    expect(ageOn('1980-10-15', '2026-10-15')).toBe(46);
  });

  it('is one year less the day before the birthday', () => {
    expect(ageOn('1980-10-16', '2026-10-15')).toBe(45);
    expect(ageOn('1980-11-01', '2026-10-15')).toBe(45);
  });

  it('handles a leap-day birthday', () => {
    expect(ageOn('2000-02-29', '2026-02-28')).toBe(25);
    expect(ageOn('2000-02-29', '2026-03-01')).toBe(26);
  });

  it('returns null without a date of birth, a bad date or a future date', () => {
    expect(ageOn(null, '2026-10-15')).toBeNull();
    expect(ageOn(undefined, '2026-10-15')).toBeNull();
    expect(ageOn('', '2026-10-15')).toBeNull();
    expect(ageOn('nope', '2026-10-15')).toBeNull();
    expect(ageOn('2030-01-01', '2026-10-15')).toBeNull();
  });
});
