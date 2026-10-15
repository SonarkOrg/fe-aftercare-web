import { formatRamq, isValidRamq, normalizeRamq } from './ramq.util';

describe('ramq.util', () => {
  it('normalizes: upper-case, no spaces or hyphens', () => {
    expect(normalizeRamq(' trem 6854-1212 ')).toBe('TREM68541212');
    expect(normalizeRamq(null)).toBe('');
  });

  it('accepts 4 letters + 8 digits, with spaces, hyphens and any case', () => {
    for (const v of ['TREM68541212', 'trem68541212', 'TREM 6854 1212', 'TREM-6854-1212', 'ABCD01010101', 'ABCD00123100', 'ABCD62011231']) {
      expect(isValidRamq(v)).withContext(v).toBeTrue();
    }
  });

  it('rejects wrong shapes', () => {
    for (const v of ['', 'TREM', 'TREM6854121', 'TREM685412123', '1234ABCDEFGH', 'TRE168541212', 'TREM6854121A', null, undefined]) {
      expect(isValidRamq(v)).withContext(String(v)).toBeFalse();
    }
  });

  it('checks the month part (01-12 or 51-62) and the day part (01-31)', () => {
    expect(isValidRamq('TREM68001212')).toBeFalse(); // month 00
    expect(isValidRamq('TREM68131212')).toBeFalse(); // month 13
    expect(isValidRamq('TREM68501212')).toBeFalse(); // month 50
    expect(isValidRamq('TREM68631212')).toBeFalse(); // month 63
    expect(isValidRamq('TREM68120012')).toBeFalse(); // day 00
    expect(isValidRamq('TREM68123212')).toBeFalse(); // day 32
    expect(isValidRamq('TREM68511212')).toBeTrue();  // month 51
  });

  it('formats as 4-4-4 and leaves other lengths alone', () => {
    expect(formatRamq('TREM68541212')).toBe('TREM 6854 1212');
    expect(formatRamq('trem-6854-1212')).toBe('TREM 6854 1212');
    expect(formatRamq('short')).toBe('short');
  });
});
