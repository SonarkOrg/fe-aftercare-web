import '../testing/i18n-testing.module';
import { DATE_PATTERNS, DatePreset } from './date-presets';
import { fmtClock, fmtDate, fmtDuration, fmtFileSize, fmtList, fmtNum, fmtPct, torontoOffset } from './format';

describe('format', () => {
  const INSTANT = '2026-10-15T18:05:00Z'; // 14:05 in Toronto (EDT)

  it('French clock times: "8 h" on the hour, "14 h 05" otherwise, non-breaking spaces, "à" between date and time', () => {
    expect(fmtDate('2026-10-15T12:00:00Z', 'time', 'fr')).toBe('8\u00a0h');
    expect(fmtDate('2026-10-15T18:05:00Z', 'time', 'fr')).toBe('14\u00a0h\u00a005');
    expect(fmtDate('2026-10-15T13:05:00Z', 'dateTime', 'fr')).toBe('15 oct.\u00a0à\u00a09\u00a0h\u00a005');
    expect(fmtDate('2026-10-15T13:05:00Z', 'time', 'fr')).toBe(fmtClock('09:05', 'fr'));
  });

  it('every preset, in both languages', () => {
    const expected: Record<DatePreset, [string, string]> = {
      date: ['15 oct. 2026', '15 Oct 2026'],
      dateShort: ['15 oct.', '15 Oct'],
      dayShort: ['jeu. 15 oct.', 'Thu 15 Oct'],
      dayShortYear: ['jeu. 15 oct. 2026', 'Thu 15 Oct 2026'],
      dayLong: ['jeudi 15 octobre', 'Thursday 15 October'],
      dayLongYear: ['jeudi 15 octobre 2026', 'Thursday, 15 October 2026'],
      weekdayDay: ['jeu. 15', 'Thu 15'],
      time: ['14 h 05', '14:05'],
      dateTime: ['15 oct. à 14 h 05', '15 Oct, 14:05'],
      isoDateTime: ['2026-10-15 14:05', '2026-10-15 14:05'],
      isoDate: ['2026-10-15', '2026-10-15']
    };
    for (const preset of Object.keys(DATE_PATTERNS.fr) as DatePreset[]) {
      expect(fmtDate(INSTANT, preset, 'fr').replace(/\s/g, ' ')).withContext('fr ' + preset).toBe(expected[preset][0]);
      expect(fmtDate(INSTANT, preset, 'en').replace(/\s/g, ' ')).withContext('en ' + preset).toBe(expected[preset][1]);
    }
  });

  it('follows daylight saving time per instant', () => {
    expect(torontoOffset(new Date('2026-03-08T06:30:00Z'))).toBe('-0500'); // still EST before 07:00Z
    expect(fmtDate('2026-03-08T06:30:00Z', 'time', 'en')).toBe('01:30');
    expect(fmtDate('2026-03-08T07:30:00Z', 'time', 'en')).toBe('03:30'); // 02:30 does not exist
    expect(fmtDate('2026-11-01T05:30:00Z', 'time', 'en')).toBe('01:30'); // EDT, the first 01:30
    expect(fmtDate('2026-11-01T06:30:00Z', 'time', 'en')).toBe('01:30'); // EST, the second 01:30
    expect(fmtDate('2026-11-01T07:30:00Z', 'time', 'en')).toBe('02:30');
  });

  it('a calendar date is never shifted by the time zone', () => {
    expect(fmtDate('2026-10-15', 'isoDate', 'en')).toBe('2026-10-15');
    expect(fmtDate('2026-10-15', 'dayLongYear', 'fr')).toBe('jeudi 15 octobre 2026');
    expect(fmtDate('2026-01-01', 'date', 'en')).toBe('1 Jan 2026');
  });

  it('null and empty give a dash', () => {
    expect(fmtDate(null, 'date', 'fr')).toBe('—');
    expect(fmtDate('', 'date', 'en')).toBe('—');
    expect(fmtNum(null, '1.0-0', 'fr')).toBe('—');
    expect(fmtPct(undefined, 'fr')).toBe('—');
  });

  it('numbers', () => {
    expect(fmtNum(38.4, '1.1-1', 'fr')).toBe('38,4');
    expect(fmtNum('38.4', '1.1-1', 'en')).toBe('38.4');
    expect(fmtNum('abc', '1.0-0', 'fr')).toBe('abc');
    expect(fmtNum(1234, '1.0-0', 'fr')).toBe('1 234');
  });

  it('percent with a no-break space in French', () => {
    expect(fmtPct(0.825, 'fr')).toBe('83 %');
    expect(fmtPct(0.825, 'en')).toBe('83%');
  });

  it('file sizes and durations', () => {
    expect(fmtFileSize(1.2 * 1024 * 1024, 'fr')).toBe('1,2 Mo');
    expect(fmtFileSize(1.2 * 1024 * 1024, 'en')).toBe('1.2 MB');
    expect(fmtFileSize(850 * 1024 / 1024, 'fr')).toBe('850 o');
    expect(fmtFileSize(850 * 1024, 'fr')).toBe('850 ko');
    expect(fmtDuration(125)).toBe('2 h 05');
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDuration(null)).toBe('—');
  });

  it('wall-clock times', () => {
    expect(fmtClock('14:05', 'fr')).toBe('14 h 05');
    expect(fmtClock('08:00', 'fr')).toBe('8 h');
    expect(fmtClock('8:05', 'en')).toBe('08:05');
  });

  it('lists', () => {
    expect(fmtList(['a', 'b', 'c'], 'fr')).toBe('a, b et c');
    expect(fmtList(['a', 'b', 'c'], 'en')).toBe('a, b and c');
  });
});
