import { testT } from '../testing/i18n-testing.module';
import { RuleJson } from '../models/questionnaire-definition.model';
import { JANE, SEED_RULES, alertDto, appointment, checkInDto, followUp } from '../testing/fixtures';
import {
  alertThreshold, buildRows, buildSeries, chartTodayDay, computeStatus, followUpDay, missedYesterday
} from './patient-status';

const t = testT('en');
const texts = (r: { key: any; params?: any }[]) => r.map(m => t(m.key, m.params));

describe('patient-status', () => {
  const today = '2026-10-13'; // follow-up 2026-10-10 .. 2026-10-17, day 3
  const f = followUp();
  const ci = (date: string, over = {}) => checkInDto({ checkInDate: date, ...over });
  const st = (alerts = [] as any[], checkIns = [ci('2026-10-12')], fu: any = f) =>
    computeStatus({ followUp: fu, alerts, checkIns, today });

  describe('computeStatus', () => {
    it('OPEN HIGH -> CRITICAL, even with no follow-up', () => {
      expect(st([alertDto()], [], null).status).toBe('CRITICAL');
    });
    it('ACKNOWLEDGED HIGH only -> ATTENTION', () => {
      expect(st([alertDto({ status: 'ACKNOWLEDGED' })]).status).toBe('ATTENTION');
    });
    it('OPEN MEDIUM -> ATTENTION', () => {
      expect(st([alertDto({ severity: 'MEDIUM' })]).status).toBe('ATTENTION');
    });
    it('missed yesterday with no alerts -> ATTENTION', () => {
      const r = st([], []);
      expect(r.status).toBe('ATTENTION');
      expect(texts(r.reasons)).toEqual(['Missed check-in 2026-10-12']);
    });
    it('active, no alerts, checked in -> STABLE', () => {
      expect(st()).toEqual({ status: 'STABLE', reasons: [{ key: 'status.reason.onTrack' }] });
    });
    it('yesterday = discharge day (day 0), no check-in -> not missed -> STABLE', () => {
      expect(computeStatus({ followUp: f, alerts: [], checkIns: [], today: '2026-10-11' }).status).toBe('STABLE');
    });
    it('EXPIRED display + no alerts -> INACTIVE', () => {
      expect(st([], [], followUp({ status: 'EXPIRED' })).status).toBe('INACTIVE');
    });
    it('no follow-up -> INACTIVE', () => {
      expect(st([], [], null)).toEqual({ status: 'INACTIVE', reasons: [{ key: 'status.reason.noFollowUp' }] });
    });
    it('resolved alerts are ignored', () => {
      expect(st([alertDto({ status: 'RESOLVED' })]).status).toBe('STABLE');
    });
    it('lists every applicable reason', () => {
      const r = st([alertDto({ id: 1 }), alertDto({ id: 2 }), alertDto({ id: 3, severity: 'MEDIUM', status: 'ACKNOWLEDGED' })], []);
      expect(r.status).toBe('CRITICAL');
      expect(texts(r.reasons)).toEqual(['2 high alerts open', '1 alert unresolved', 'Missed check-in 2026-10-12']);
    });
    it('ATTENTION reason counts all unresolved alerts', () => {
      expect(texts(st([alertDto({ severity: 'MEDIUM' }), alertDto({ id: 2, status: 'ACKNOWLEDGED' })]).reasons)).toEqual(['2 alerts unresolved']);
    });
  });

  describe('followUpDay', () => {
    it('counts from the discharge date', () => {
      expect(followUpDay(f, today)).toEqual({ day: 3, total: 7, ended: false });
    });
    it('clamps to [0, durationDays] and flags ended', () => {
      expect(followUpDay(f, '2026-10-08')).toEqual({ day: 0, total: 7, ended: false });
      expect(followUpDay(f, '2026-10-25')).toEqual({ day: 7, total: 7, ended: true });
    });
    it('null without follow-up', () => {
      expect(followUpDay(null, today)).toBeNull();
    });
  });

  describe('chartTodayDay', () => {
    it('today only counts as missed once it is over, unless the patient already checked in', () => {
      expect(chartTodayDay(f, false, today)).toBe(2);
      expect(chartTodayDay(f, true, today)).toBe(3);
      expect(chartTodayDay(f, false, '2026-10-25')).toBe(7); // ended: every expected day is over
    });
    it('a CLOSED follow-up is capped at the day it was closed: no missed ticks after closure', () => {
      const closed = followUp({ status: 'CLOSED', closedAt: '2026-10-11T18:00:00Z' }); // closed on day 1 (Toronto date 2026-10-11)
      expect(chartTodayDay(closed, false, '2026-10-16')).toBe(1);
      expect(chartTodayDay(closed, true, '2026-10-16')).toBe(1);
    });
    it('uses the Toronto date of the closure instant', () => {
      const closed = followUp({ status: 'CLOSED', closedAt: '2026-10-12T02:00:00Z' }); // 22:00 on 2026-10-11 in Toronto
      expect(chartTodayDay(closed, true, '2026-10-16')).toBe(1);
    });
  });

  describe('missedYesterday window edges', () => {
    it('yesterday = dischargeDate + 1 counts', () => {
      expect(missedYesterday(f, [], '2026-10-12')).toBeTrue();
    });
    it('yesterday = endDate counts', () => {
      expect(missedYesterday(f, [], '2026-10-18')).toBeTrue();
    });
    it('yesterday = discharge day or after endDate does not', () => {
      expect(missedYesterday(f, [], '2026-10-11')).toBeFalse();
      expect(missedYesterday(f, [], '2026-10-19')).toBeFalse();
    });
    it('a check-in yesterday, or a non-ACTIVE follow-up, is not missed', () => {
      expect(missedYesterday(f, [ci('2026-10-12')], today)).toBeFalse();
      expect(missedYesterday(followUp({ status: 'EXPIRED' }), [], today)).toBeFalse();
    });
  });

  describe('alertThreshold', () => {
    it('seed rules: PAIN -> 7, TEMPERATURE -> 38', () => {
      expect(alertThreshold(SEED_RULES, 'PAIN')).toBe(7);
      expect(alertThreshold(SEED_RULES, 'TEMPERATURE')).toBe(38);
    });
    it('only MEDIUM >= rules -> their min', () => {
      expect(alertThreshold(SEED_RULES.filter(r => r.outcome.severity === 'MEDIUM'), 'PAIN')).toBe(5);
    });
    it('no >= ALERT rule -> null', () => {
      expect(alertThreshold(SEED_RULES, 'FEVER')).toBeNull();
      expect(alertThreshold([], 'PAIN')).toBeNull();
    });
    it('NEEDS_REVIEW outcome and non-numeric values are ignored', () => {
      const rules: RuleJson[] = [
        { linkId: 'PAIN', operator: '>=', value: 3, outcome: { type: 'NEEDS_REVIEW', message: { fr: '', en: '' } } },
        { linkId: 'PAIN', operator: '>=', value: ['x'], outcome: { type: 'ALERT', severity: 'HIGH', message: { fr: '', en: '' } } }
      ];
      expect(alertThreshold(rules, 'PAIN')).toBeNull();
    });
  });

  describe('buildSeries', () => {
    it('indexes days from the discharge date, sorted, skipping missing/non-numeric answers', () => {
      const s = buildSeries(f, [ci('2026-10-12', { id: 2, pain: 8 }), ci('2026-10-11', { id: 1, pain: 3 }),
        ci('2026-10-13', { id: 3 }), ci('2026-10-14', { id: 4, temp: 37 })], 'PAIN');
      expect(s).toEqual([{ day: 1, date: '2026-10-11', value: 3 }, { day: 2, date: '2026-10-12', value: 8 }]);
    });
    it('uses the current follow-up only', () => {
      expect(buildSeries(f, [ci('2026-10-12', { followUpId: 99, pain: 8 })], 'PAIN')).toEqual([]);
      expect(buildSeries(null, [ci('2026-10-12', { pain: 8 })], 'PAIN')).toEqual([]);
    });
  });

  describe('buildRows', () => {
    const now = '2026-10-13T12:00:00';
    const base = (over = {}) => ({
      patients: [{ ...JANE, id: 5, activeFollowUp: f }], alerts: [], checkIns: [], appointments: [],
      rules: new Map([[7, SEED_RULES]]), today, nowLocal: now, ...over
    });

    it('builds identity, series, threshold and flags', () => {
      const [r] = buildRows(base({ checkIns: [ci('2026-10-12', { pain: 8 }), ci('2026-10-13', { id: 2, pain: 4 })] }));
      expect(r.name).toBe('Jane Doe');
      expect(r.initials).toBe('JD');
      expect(r.status).toBe('STABLE');
      expect(r.lastPain).toBe(4);
      expect(r.painThreshold).toBe(7);
      expect(r.day).toEqual({ day: 3, total: 7, ended: false });
      expect(r.expectedToday).toBeTrue();
      expect(r.checkedInToday).toBeTrue();
      expect(r.missedYesterday).toBeFalse();
    });
    it('lastCheckInDate spans follow-ups; series uses the current one only', () => {
      const [r] = buildRows(base({ checkIns: [ci('2026-10-05', { followUpId: 3, pain: 9 }), ci('2026-10-12', { id: 2, pain: 2 })] }));
      expect(r.lastCheckInDate).toBe('2026-10-12');
      expect(r.painSeries.length).toBe(1);
      const [old] = buildRows(base({ checkIns: [ci('2026-10-05', { followUpId: 3 })], patients: [{ ...JANE, id: 5, activeFollowUp: null }] }));
      expect(old.lastCheckInDate).toBe('2026-10-05');
      expect(old.status).toBe('INACTIVE');
    });
    it('nextAppointment skips past and closed statuses', () => {
      const [r] = buildRows(base({ appointments: [
        appointment({ id: 1, scheduledAt: '2026-10-13T08:00:00' }),
        appointment({ id: 2, scheduledAt: '2026-10-14T08:00:00', status: 'CANCELLED' }),
        appointment({ id: 3, scheduledAt: '2026-10-16T09:00:00' }),
        appointment({ id: 4, scheduledAt: '2026-10-15T09:00:00', status: 'READY' }),
        appointment({ id: 5, patientId: 99, scheduledAt: '2026-10-14T09:00:00' })
      ] }));
      expect(r.nextAppointment!.id).toBe(4);
    });
    it('counts unresolved and openHigh', () => {
      const [r] = buildRows(base({ alerts: [alertDto({ id: 1 }), alertDto({ id: 2, status: 'ACKNOWLEDGED' }),
        alertDto({ id: 3, severity: 'MEDIUM' }), alertDto({ id: 4, status: 'RESOLVED' }), alertDto({ id: 5, patientId: 99 })] }));
      expect(r.unresolved).toBe(3);
      expect(r.openHigh).toBe(1);
      expect(r.status).toBe('CRITICAL');
    });
  });
});
