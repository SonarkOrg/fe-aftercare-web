import { appointment } from '../../testing/fixtures';
import { endTime, groupForBoard, isOpenToday, layoutWeek } from './appointment-board';

describe('appointment-board', () => {
  describe('groupForBoard', () => {
    it('orders groups review, missing, awaiting, ready, closed and omits empty ones', () => {
      const g = groupForBoard([
        appointment({ id: 1, status: 'COMPLETED' }),
        appointment({ id: 2, status: 'READY' }),
        appointment({ id: 3, status: 'SCHEDULED', questionnaireMissing: false }),
        appointment({ id: 4, status: 'SCHEDULED', questionnaireMissing: true }),
        appointment({ id: 5, status: 'NEEDS_REVIEW' })
      ]);
      expect(g.map(x => x.key)).toEqual(['review', 'missing', 'awaiting', 'ready', 'closed']);
      expect(g[4].collapsed).toBeTrue();
      expect(groupForBoard([appointment({ status: 'READY' })]).map(x => x.key)).toEqual(['ready']);
    });
    it('sorts inside a group by scheduledAt then id', () => {
      const g = groupForBoard([
        appointment({ id: 3, status: 'READY', scheduledAt: '2026-10-14T09:00:00' }),
        appointment({ id: 2, status: 'READY', scheduledAt: '2026-10-14T09:00:00' }),
        appointment({ id: 1, status: 'READY', scheduledAt: '2026-10-14T10:00:00' })
      ]);
      expect(g[0].items.map(a => a.id)).toEqual([2, 3, 1]);
    });
  });

  describe('appointments without a questionnaire (walk-ins)', () => {
    it('go to their own « no questionnaire » group, never « awaiting » or « missing »', () => {
      const g = groupForBoard([
        appointment({ id: 1, status: 'SCHEDULED', questionnaireDefinitionId: null, questionnaireUrl: null, questionnaireVersion: null, walkIn: true }),
        appointment({ id: 2, status: 'SCHEDULED' })
      ]);
      expect(g.map(x => x.key)).toEqual(['awaiting', 'noForm']);
      expect(g[1].title).toBe('appts.noQuestionnaire');
      expect(g[1].items.map(a => a.id)).toEqual([1]);
    });
    it('a fixture without the member (older payload) still counts as having a questionnaire', () => {
      const a = appointment({ id: 3, status: 'SCHEDULED' }) as unknown as Record<string, unknown>;
      delete a['questionnaireDefinitionId'];
      expect(groupForBoard([a as never]).map(x => x.key)).toEqual(['awaiting']);
    });
  });

  describe('arrived rows', () => {
    it('sort first inside each open group and do not add a group', () => {
      const g = groupForBoard([
        appointment({ id: 1, status: 'READY', scheduledAt: '2026-10-14T09:00:00' }),
        appointment({ id: 2, status: 'READY', scheduledAt: '2026-10-14T11:00:00', arrivedAt: '2026-10-14T14:50:00Z' }),
        appointment({ id: 3, status: 'READY', scheduledAt: '2026-10-14T10:00:00', arrivedAt: '2026-10-14T14:40:00Z' }),
        appointment({ id: 4, status: 'SCHEDULED', questionnaireMissing: true, scheduledAt: '2026-10-14T08:00:00' }),
        appointment({ id: 5, status: 'SCHEDULED', questionnaireMissing: true, scheduledAt: '2026-10-14T12:00:00', arrivedAt: '2026-10-14T14:55:00Z' })
      ]);
      expect(g.map(x => x.key)).toEqual(['missing', 'ready']);
      expect(g[0].items.map(a => a.id)).toEqual([5, 4]);
      expect(g[1].items.map(a => a.id)).toEqual([3, 2, 1]);
    });
    it('closed rows keep the plain time order', () => {
      const g = groupForBoard([
        appointment({ id: 1, status: 'COMPLETED', scheduledAt: '2026-10-14T09:00:00' }),
        appointment({ id: 2, status: 'COMPLETED', scheduledAt: '2026-10-14T08:00:00', arrivedAt: '2026-10-14T12:00:00Z' })
      ]);
      expect(g[0].items.map(a => a.id)).toEqual([2, 1]);
    });
  });

  describe('isOpenToday', () => {
    it('is true only for an open status on the given business day', () => {
      const day = '2026-10-14';
      expect(isOpenToday({ status: 'READY', scheduledAt: '2026-10-14T09:00:00' }, day)).toBeTrue();
      expect(isOpenToday({ status: 'SCHEDULED', scheduledAt: '2026-10-14T23:59:00' }, day)).toBeTrue();
      expect(isOpenToday({ status: 'NEEDS_REVIEW', scheduledAt: '2026-10-14T00:00:00' }, day)).toBeTrue();
      expect(isOpenToday({ status: 'READY', scheduledAt: '2026-10-15T09:00:00' }, day)).toBeFalse();
      for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
        expect(isOpenToday({ status, scheduledAt: '2026-10-14T09:00:00' }, day)).toBeFalse();
      }
    });
  });

  describe('layoutWeek', () => {
    const monday = '2026-10-12';
    const opts = { today: '2026-10-14' };
    it('positions 08:30 + 30 min with startHour 7: 96px per hour, so 30 minutes is 48px', () => {
      const w = layoutWeek([appointment({ scheduledAt: '2026-10-14T08:30:00', durationMinutes: 30 })], monday, opts);
      expect(w.startHour).toBe(7);
      expect(w.endHour).toBe(19);
      const b = w.days[2].blocks[0];
      expect(b.top).toBe(144);
      expect(b.height).toBe(48);
    });
    it('a 15-minute appointment is drawn at the 44px minimum', () => {
      const w = layoutWeek([appointment({ scheduledAt: '2026-10-14T08:30:00', durationMinutes: 15 })], monday, opts);
      expect(w.days[2].blocks[0].height).toBe(44);
    });
    it('back-to-back short blocks use their VISUAL end for lanes, so they never overlap on screen', () => {
      // 15-minute slots at 09:00 and 09:15 are each drawn 44px (27.5 min) tall: they would overlap in a single lane
      const w = layoutWeek([appointment({ id: 1, scheduledAt: '2026-10-14T09:00:00', durationMinutes: 15 }),
        appointment({ id: 2, scheduledAt: '2026-10-14T09:15:00', durationMinutes: 15 }),
        appointment({ id: 3, scheduledAt: '2026-10-14T09:30:00', durationMinutes: 15 })], monday, opts);
      const bl = w.days[2].blocks;
      expect(bl.map(b => [b.lane, b.lanes])).toEqual([[0, 2], [1, 2], [0, 2]]);
      // same-lane blocks never intersect vertically
      for (const a of bl) {
        for (const b of bl) {
          if (a !== b && a.lane === b.lane) {
            expect(a.top + a.height <= b.top || b.top + b.height <= a.top).toBeTrue();
          }
        }
      }
    });
    it('the visible end hour accounts for a minimum-height block at the end of the day', () => {
      const w = layoutWeek([appointment({ scheduledAt: '2026-10-14T18:20:00', durationMinutes: 10 })], monday, opts);
      expect(w.endHour).toBe(19);
      const w2 = layoutWeek([appointment({ scheduledAt: '2026-10-14T19:50:00', durationMinutes: 10 })], monday, opts);
      expect(w2.endHour).toBe(21);
    });
    it('an early 06:00 appointment lowers startHour; a late one raises endHour', () => {
      const w = layoutWeek([appointment({ id: 1, scheduledAt: '2026-10-14T06:00:00' }),
        appointment({ id: 2, scheduledAt: '2026-10-14T19:30:00', durationMinutes: 60 })], monday, opts);
      expect(w.startHour).toBe(6);
      expect(w.endHour).toBe(21);
    });
    it('two overlapping appointments take lanes 0 and 1 of 2', () => {
      const w = layoutWeek([appointment({ id: 1, scheduledAt: '2026-10-14T09:00:00', durationMinutes: 60 }),
        appointment({ id: 2, scheduledAt: '2026-10-14T09:30:00', durationMinutes: 60 })], monday, opts);
      expect(w.days[2].blocks.map(b => [b.lane, b.lanes])).toEqual([[0, 2], [1, 2]]);
    });
    it('touching appointments (end == start) share lane 0', () => {
      const w = layoutWeek([appointment({ id: 1, scheduledAt: '2026-10-14T09:00:00', durationMinutes: 30 }),
        appointment({ id: 2, scheduledAt: '2026-10-14T09:30:00', durationMinutes: 30 })], monday, opts);
      expect(w.days[2].blocks.map(b => [b.lane, b.lanes])).toEqual([[0, 1], [0, 1]]);
    });
    it('puts blocks in the right day column and flags today', () => {
      const w = layoutWeek([appointment({ scheduledAt: '2026-10-16T10:00:00' })], monday, opts);
      expect(w.days.map(d => d.blocks.length)).toEqual([0, 0, 0, 0, 1, 0, 0]);
      expect(w.days.map(d => d.isToday)).toEqual([false, false, true, false, false, false, false]);
      expect(w.days[0].label).toBe('Mon 12');
    });
  });

  it('endTime wraps past midnight', () => {
    expect(endTime('2026-10-14T23:45:00', 30)).toBe('00:15');
    expect(endTime('2026-10-14T08:30:00', 45)).toBe('09:15');
  });
});
