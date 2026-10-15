import { addDays, buildPatientLink, businessDateOf, businessHour, daysBetween, humanize, initials, mondayOf, businessNow, relativeDay, businessToday } from './link.util';

describe('link.util', () => {
  it('buildPatientLink uses the document base URI', () => {
    expect(buildPatientLink('abc')).toBe(new URL('q/abc', document.baseURI).toString());
    expect(buildPatientLink('abc')).toContain('/q/abc');
  });

  it('businessToday is the America/Toronto calendar date, not the browser or UTC date', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-10-15T02:30:00Z')); // 22:30 on the 14th in Toronto (EDT, UTC-4)
      expect(businessToday()).toBe('2026-10-14');
      jasmine.clock().mockDate(new Date('2026-10-15T04:00:00Z')); // 00:00 on the 15th in Toronto
      expect(businessToday()).toBe('2026-10-15');
      jasmine.clock().mockDate(new Date('2026-01-15T04:59:00Z')); // 23:59 on the 14th (EST, UTC-5)
      expect(businessToday()).toBe('2026-01-14');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('businessDateOf and businessHour use America/Toronto', () => {
    expect(businessDateOf('2026-10-14T02:30:00Z')).toBe('2026-10-13');
    expect(businessHour(new Date('2026-10-15T04:00:00Z'))).toBe(0);
    expect(businessHour(new Date('2026-10-15T16:05:00Z'))).toBe(12);
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

describe('link.util date helpers', () => {
  it('businessNow is America/Toronto wall time', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-10-15T03:05:09Z'));
      expect(businessNow()).toBe('2026-10-14T23:05:09');
    } finally {
      jasmine.clock().uninstall();
    }
  });
  it('daysBetween is calendar math', () => {
    expect(daysBetween('2026-10-10', '2026-10-13')).toBe(3);
    expect(daysBetween('2026-10-13', '2026-10-10')).toBe(-3);
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
  });
  it('relativeDay', () => {
    expect(relativeDay('2026-10-13', '2026-10-13')).toBe('Today');
    expect(relativeDay('2026-10-12', '2026-10-13')).toBe('Yesterday');
    expect(relativeDay('2026-10-10', '2026-10-13')).toBe('3 days ago');
    expect(relativeDay('2026-10-16', '2026-10-13')).toBe('in 3 days');
  });
  it('initials', () => {
    expect(initials('marie', 'Tremblay')).toBe('MT');
  });
});
