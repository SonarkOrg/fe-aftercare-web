import { extractNam, formatRamq, isValidRamq, normalizeRamq } from './ramq.util';

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
  describe('extractNam', () => {
    it('returns the NAM from a bare scan, in any case, with spaces or hyphens', () => {
      expect(extractNam('ROYS85522712')).toBe('ROYS85522712');
      expect(extractNam('roys 8552 2712')).toBe('ROYS85522712');
      expect(extractNam(' ROYS-8552-2712\n')).toBe('ROYS85522712');
    });

    it('recognises a NAM typed in pairs or with dots or slashes', () => {
      expect(extractNam('TREM 68 54 12 12')).toBe('TREM68541212');
      expect(extractNam('TREM.6854.1212')).toBe('TREM68541212');
      expect(extractNam('trem/68/54/12/12')).toBe('TREM68541212');
      expect(extractNam('TREM  6854 1212')).toBeNull(); // two separators in a row are not a NAM
    });

    it('takes the first valid NAM from a longer payload and drops the rest', () => {
      expect(extractNam('01ROYS85522712SOPHIE19850412')).toBe('ROYS85522712');
      expect(extractNam('ROYS85522712 TREM68541212')).toBe('ROYS85522712');
    });

    it('skips a NAM-shaped substring that fails the structure check', () => {
      expect(extractNam('ROYS85992712 TREM68541212')).toBe('TREM68541212'); // month 99
      expect(extractNam('ROYS85992712')).toBeNull();
    });

    it('returns null for names, dates, short text and empty input', () => {
      for (const v of ['', 'tremblay', 'Marie Tremblay', '12/04/1968', '12041968', 'ROYS8552271', null as unknown as string]) {
        expect(extractNam(v)).withContext(String(v)).toBeNull();
      }
    });
  });
});
