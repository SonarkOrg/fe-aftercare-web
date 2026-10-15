import { PatientRow } from '../../shared/care.model';
import { businessDateOf } from '../../shared/link.util';
import { alertDto, appointment, followUp } from '../../testing/fixtures';
import {
  ackHigh, activeStats, appointmentsToPrepare, checkInsToday, greeting, missedYesterdayCount, newToday, openHigh, progressSegments, scaleLabels
} from './dashboard.metrics';

const row = (over: Partial<PatientRow>): PatientRow => ({ expectedToday: false, checkedInToday: false, missedYesterday: false, ...over } as PatientRow);

describe('dashboard.metrics', () => {
  it('openHigh excludes ACK and MEDIUM', () => {
    const a = [alertDto(), alertDto({ id: 2, status: 'ACKNOWLEDGED' }), alertDto({ id: 3, severity: 'MEDIUM' }), alertDto({ id: 4, status: 'RESOLVED' })];
    expect(openHigh(a)).toBe(1);
    expect(ackHigh(a)).toBe(1);
  });

  it('newToday uses the America/Toronto date of createdAt', () => {
    const iso = '2026-10-13T14:00:00Z';
    expect(businessDateOf(iso)).toBe('2026-10-13');
    expect(businessDateOf('2026-10-14T02:30:00Z')).toBe('2026-10-13'); // 22:30 in Toronto (EDT)
    const a = [alertDto({ createdAt: iso }), alertDto({ id: 2, createdAt: '2026-10-12T14:00:00Z' })];
    expect(newToday(a, '2026-10-13')).toBe(1);
  });

  it('checkInsToday: received is a subset of expected; day-0 check-ins are not expected', () => {
    const rows = [row({ expectedToday: true, checkedInToday: true }), row({ expectedToday: true }), row({ checkedInToday: true })];
    expect(checkInsToday(rows)).toEqual({ expected: 2, received: 1 });
    expect(checkInsToday([])).toEqual({ expected: 0, received: 0 });
  });

  it('missedYesterdayCount counts flagged rows', () => {
    expect(missedYesterdayCount([row({ missedYesterday: true }), row({}), row({ missedYesterday: true })])).toBe(2);
  });

  it('appointmentsToPrepare: today+tomorrow only, review + missing, no double count', () => {
    const t = '2026-10-13';
    const r = appointmentsToPrepare([
      appointment({ id: 1, scheduledAt: '2026-10-13T09:00:00', status: 'NEEDS_REVIEW', questionnaireMissing: true }),
      appointment({ id: 2, scheduledAt: '2026-10-14T09:00:00', status: 'SCHEDULED', questionnaireMissing: true }),
      appointment({ id: 3, scheduledAt: '2026-10-15T09:00:00', status: 'NEEDS_REVIEW' }),
      appointment({ id: 4, scheduledAt: '2026-10-12T09:00:00', status: 'NEEDS_REVIEW' }),
      appointment({ id: 5, scheduledAt: '2026-10-14T10:00:00', status: 'READY' })
    ], t);
    expect(r).toEqual({ needsReview: 1, missing: 1, total: 2 });
  });

  it('greeting follows the hour', () => {
    expect([greeting(8), greeting(12), greeting(17), greeting(18)]).toEqual(['Good morning', 'Good afternoon', 'Good afternoon', 'Good evening']);
  });

  describe('overview progress', () => {
    const t = '2026-10-13';
    const fu = followUp({ dischargeDate: '2026-10-10', endDate: '2026-10-17' });
    const rows = [
      row({ followUp: fu, status: 'STABLE', expectedToday: true, checkedInToday: true }),
      row({ followUp: fu, status: 'CRITICAL', expectedToday: true, checkedInToday: false, missedYesterday: true }),
      row({ followUp: fu, status: 'STABLE', expectedToday: true, checkedInToday: false }),
      row({ followUp: followUp({ status: 'CLOSED' }), status: 'INACTIVE' })
    ];
    it('activeStats counts active follow-ups only', () => {
      expect(activeStats(rows, t)).toEqual({ active: 3, stable: 2, critical: 1, expectedYesterday: 3, missedYesterday: 1 });
    });
    it('today: A = received, B = pending, no hatched remainder', () => {
      expect(progressSegments(rows, 'today', t)).toEqual({ expected: 3, received: 1, pending: 2, missed: 0, aPct: 33, abPct: 33 });
    });
    it('yesterday: A = received, B = 0, remainder = missed', () => {
      expect(progressSegments(rows, 'yesterday', t)).toEqual({ expected: 3, received: 2, pending: 0, missed: 1, aPct: 67, abPct: 67 });
    });
    it('nothing expected gives an empty bar', () => {
      expect(progressSegments([], 'today', t)).toEqual({ expected: 0, received: 0, pending: 0, missed: 0, aPct: 0, abPct: 0 });
    });
    describe('today fill is proportional to received/expected', () => {
      const due = (received: number, expected: number) =>
        Array.from({ length: expected }, (_, i) => row({ followUp: fu, status: 'STABLE', expectedToday: true, checkedInToday: i < received }));
      it('0 of 2: no fill, everything hatched', () => {
        expect(progressSegments(due(0, 2), 'today', t)).toEqual({ expected: 2, received: 0, pending: 2, missed: 0, aPct: 0, abPct: 0 });
      });
      it('1 of 2: half filled', () => {
        expect(progressSegments(due(1, 2), 'today', t)).toEqual({ expected: 2, received: 1, pending: 1, missed: 0, aPct: 50, abPct: 50 });
      });
      it('2 of 2: fully filled', () => {
        expect(progressSegments(due(2, 2), 'today', t)).toEqual({ expected: 2, received: 2, pending: 0, missed: 0, aPct: 100, abPct: 100 });
      });
      it('0 of 0: nothing due, no bar', () => {
        const p = progressSegments(due(0, 0), 'today', t);
        expect(p.expected).toBe(0);
        expect(p.aPct).toBe(0);
        expect(p.abPct).toBe(0);
      });
    });
    it('scale labels drop a value too close to a neighbour', () => {
      expect(scaleLabels(45, 75)).toEqual([0, 45, 75, 100]);
      expect(scaleLabels(3, 96)).toEqual([0, 100]);
      expect(scaleLabels(50, 50)).toEqual([0, 50, 100]);
    });
  });
});
