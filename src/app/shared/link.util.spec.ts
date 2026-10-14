import { addDays, buildPatientLink, humanize, mondayOf, todayLocalIsoDate } from './link.util';

describe('link.util', () => {
  it('buildPatientLink uses the document base URI', () => {
    expect(buildPatientLink('abc')).toBe(new URL('q/abc', document.baseURI).toString());
    expect(buildPatientLink('abc')).toContain('/q/abc');
  });

  it('todayLocalIsoDate uses the local calendar fields', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 14, 23, 30)); // local 23:30 (would be next day in UTC for UTC-)
    expect(todayLocalIsoDate()).toBe('2026-10-14');
    jasmine.clock().uninstall();
  });

  it('addDays and mondayOf do pure calendar math', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(mondayOf('2026-10-14')).toBe('2026-10-12'); // Wednesday
    expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
  });

  it('humanize formats enum names', () => {
    expect(humanize('POST_OP_FOLLOWUP')).toBe('Post op followup');
    expect(humanize(null)).toBe('');
  });
});
