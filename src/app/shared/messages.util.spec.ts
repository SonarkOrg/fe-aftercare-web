import '../testing/i18n-testing.module';
import { fmtDayLong, fmtDayShort, fmtTime, groupByDay } from './messages.util';

describe('messages.util', () => {
  it('groups by the America/Toronto calendar day: 03:30 UTC still belongs to the previous day', () => {
    const items = [
      { sentAt: '2026-10-14T03:30:00Z' }, // Oct 13, 23:30 in Toronto (EDT)
      { sentAt: '2026-10-14T05:00:00Z' }, // Oct 14, 01:00
      { sentAt: '2026-10-14T20:00:00Z' }
    ];
    const g = groupByDay(items, 'en');
    expect(g.map(x => x.day)).toEqual(['2026-10-13', '2026-10-14']);
    expect(g[0].items.length).toBe(1);
    expect(g[1].items.length).toBe(2);
  });

  it('labels the day in the requested language', () => {
    expect(fmtDayLong('2026-10-14T16:00:00Z', 'en')).toBe('Wednesday 14 October');
    expect(fmtDayLong('2026-10-14T16:00:00Z', 'fr')).toBe('mercredi 14 octobre');
  });

  it('groups with a custom timestamp accessor', () => {
    const g = groupByDay([{ occurredAt: '2026-10-14T16:00:00Z' }], 'en', i => i.occurredAt);
    expect(g[0].label).toBe('Wednesday 14 October');
  });

  it('formats the time in Toronto: en-CA 24 h, fr-CA with "h"', () => {
    expect(fmtTime('2026-10-14T18:30:00Z', 'en')).toBe('14:30');
    expect(fmtTime('2026-10-14T18:30:00Z', 'fr').replace(/\s/g, ' ')).toBe('14 h 30');
    expect(fmtTime('2026-01-14T18:30:00Z', 'en')).toBe('13:30'); // EST
  });

  it('formats a short day', () => {
    expect(fmtDayShort('2026-10-14T16:00:00Z')).toMatch(/^14 Oct/);
  });
});
