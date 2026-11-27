import { birthDatesFromRamq, cardExpiryLabel, extractNam, formatCardExpiry, formatRamq, isValidRamq, looksLikeNam, normalizeRamq, parseCardExpiry } from './ramq.util';

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

describe('ramq.util (phase 1B)', () => {
  const TODAY = '2026-11-26';

  describe('birthDatesFromRamq', () => {
    it('gives the one date that is not in the future', () => {
      expect(birthDatesFromRamq('TREM68541212', TODAY)).toEqual(['1968-04-12']);
    });
    it('a year that fits two centuries gives two dates, newest first', () => {
      expect(birthDatesFromRamq('TREM20010512', TODAY)).toEqual(['2020-01-05', '1920-01-05']);
    });
    it('reads +50 on the month as a marker, never as a sex', () => {
      expect(birthDatesFromRamq('ROYS85522712', TODAY)).toEqual(['1985-02-27']);
    });
    it('ignores impossible dates and malformed text', () => {
      expect(birthDatesFromRamq('TREM68023012', TODAY)).toEqual([]); // 30 February
      expect(birthDatesFromRamq('nope', TODAY)).toEqual([]);
      expect(birthDatesFromRamq('TREM 6854 1212', TODAY)).toEqual(['1968-04-12']);
    });
    it('drops a future century', () => {
      expect(birthDatesFromRamq('TREM27010512', TODAY)).toEqual(['1927-01-05']);
    });
  });

  describe('parseCardExpiry', () => {
    it('accepts every printed form', () => {
      for (const v of ['0327', '03 27', '03-27', '03/27', '03-2027', '03/2027', '2027-03']) {
        expect(parseCardExpiry(v, TODAY)).withContext(v).toBe('2027-03');
      }
    });
    it('refuses an old year, a far year and nonsense', () => {
      expect(parseCardExpiry('1103', TODAY)).toBeNull();
      expect(parseCardExpiry('03-2099', TODAY)).toBeNull();
      expect(parseCardExpiry('1327', TODAY)).toBeNull();
      expect(parseCardExpiry('0027', TODAY)).toBeNull();
      expect(parseCardExpiry('032027', TODAY)).toBeNull();
      expect(parseCardExpiry('abc', TODAY)).toBeNull();
      expect(parseCardExpiry('', TODAY)).toBeNull();
    });
    it('keeps the window edges: 24 months back and 10 years ahead are in, one more month is out', () => {
      expect(parseCardExpiry('11-2024', TODAY)).toBe('2024-11');
      expect(parseCardExpiry('10-2024', TODAY)).toBeNull();
      expect(parseCardExpiry('11-2036', TODAY)).toBe('2036-11');
      expect(parseCardExpiry('12-2036', TODAY)).toBeNull();
    });
  });

  it('formatCardExpiry writes MM-AAAA', () => {
    expect(formatCardExpiry('2027-03')).toBe('03-2027');
    expect(formatCardExpiry('x')).toBe('x');
  });

  it('cardExpiryLabel names the month in both languages', () => {
    expect(cardExpiryLabel('2027-03', 'fr')).toBe('mars 2027');
    expect(cardExpiryLabel('2027-03', 'en')).toBe('March 2027');
    expect(cardExpiryLabel('2027-12', 'fr')).toBe('décembre 2027');
    expect(cardExpiryLabel('bad', 'en')).toBe('bad');
  });

  it('looksLikeNam catches a NAM in any common typing and spares ordinary names', () => {
    for (const v of ['TREM68541212', 'trem 6854 1212', 'TREM.6854.1212', 'TREM 68 54 12 12', 'Marie TREM68541212']) {
      expect(looksLikeNam(v)).withContext(v).toBeTrue();
    }
    for (const v of ['Tremblay', 'Jean-François', 'Zzz-Test 2', '', 'Dr Roy 2026']) {
      expect(looksLikeNam(v)).withContext(v).toBeFalse();
    }
  });
});
