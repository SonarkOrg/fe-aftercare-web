import { SeriesPoint } from '../care.model';
import { ChartInputs, computeBars, dayWindow, firstDay, isAlert, missedDays, yDomain, yTicks } from './trend-chart.geometry';

const pts = (days: number[], vals?: number[]): SeriesPoint[] =>
  days.map((d, i) => ({ day: d, date: `2026-10-${String(10 + d).padStart(2, '0')}`, value: vals ? vals[i] : 3 }));

const inputs = (over: Partial<ChartInputs> = {}): ChartInputs => ({
  points: pts([1, 2, 3, 5], [3, 8, 5, 6]), totalDays: 7, threshold: 7, label: 'Pain', unit: '', domain: [0, 10], variant: 'full', todayDay: 5, ...over
});

describe('trend-chart.geometry', () => {
  it('isAlert uses >=', () => {
    expect(isAlert(7, 7)).toBeTrue();
    expect(isAlert(6.9, 7)).toBeFalse();
    expect(isAlert(9, null)).toBeFalse();
  });

  it('temperature domain starts at 35 and reaches max(39.5, ceil(max)+0.5)', () => {
    expect(yDomain({ points: pts([1], [37]), threshold: 38, domain: 'auto' })).toEqual([35, 39.5]);
    expect(yDomain({ points: pts([1], [39.2]), threshold: 38, domain: 'auto' })).toEqual([35, 40.5]);
    expect(yDomain({ points: [], threshold: null, domain: 'auto' })).toEqual([35, 39.5]);
    expect(yDomain({ points: [], threshold: null, domain: [0, 10] })).toEqual([0, 10]);
  });

  it('ticks: pain every 2, temperature every 1 from 35', () => {
    expect(yTicks([0, 10], true)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(yTicks([35, 39.5], false)).toEqual([35, 36, 37, 38, 39]);
  });

  it('missedDays respects todayDay and totalDays', () => {
    expect(missedDays(pts([1, 3]), 4, 7)).toEqual([2, 4]);
    expect(missedDays(pts([1]), 10, 3)).toEqual([2, 3]);
    expect(missedDays(pts([1]), null, 7)).toEqual([]);
  });

  it('dayWindow: full draws every day, compact at most 7 around today', () => {
    expect(dayWindow('full', 14, 3)).toEqual({ start: 1, end: 14 });
    expect(dayWindow('compact', 5, 3)).toEqual({ start: 1, end: 5 });
    expect(dayWindow('compact', 14, 4)).toEqual({ start: 1, end: 7 });
    expect(dayWindow('compact', 14, 10)).toEqual({ start: 4, end: 10 });
    expect(dayWindow('compact', 14, 14)).toEqual({ start: 8, end: 14 });
  });

  describe('full chart bars (width 640)', () => {
    const m = computeBars(inputs(), 640);
    const bar = (d: number) => m.days.find(x => x.day === d)!;

    it('one band per day with a clamped gap; bars start at the left padding', () => {
      expect(m.pad.l).toBe(48);
      expect(m.band).toBeCloseTo((640 - 48) / 7, 5);
      expect(m.gap).toBe(8); // 10 % of 84.6 clamped to 8
      expect(m.bw).toBeCloseTo(m.band - 8, 5);
      expect(bar(1).bar.x).toBeCloseTo(48 + 4, 5);
      expect(bar(2).bar.x).toBeCloseTo(48 + m.band + 4, 5);
    });

    it('bar heights map the 0-10 domain onto the plot, ends are rounded to 12', () => {
      const plotH = m.h - m.pad.t - m.pad.b;
      expect(bar(2).bar.h).toBeCloseTo(plotH * 0.8, 5);
      expect(bar(2).bar.y + bar(2).bar.h).toBeCloseTo(m.baseline, 5);
      expect(bar(2).bar.rx).toBe(12);
    });

    it('threshold bars are flagged and get a solid pill with a ▲ prefix; normal pills are not alerts', () => {
      expect(bar(2).alert).toBeTrue();
      expect(bar(2).pill!.alert).toBeTrue();
      expect(bar(2).pill!.text).toBe('▲ 8');
      expect(bar(1).alert).toBeFalse();
      expect(bar(1).pill!.text).toBe('3');
      expect(m.mode).toBe('pills');
      expect(m.alertCount).toBe(1);
    });

    it('a pill is bw wide, 36 high, and sits 4px above its bar (room is reserved above the plot)', () => {
      const p = bar(1).pill!;
      expect(p.w).toBeCloseTo(m.bw, 5);
      expect(p.h).toBe(36);
      expect(p.y + p.h + 4).toBeCloseTo(bar(1).bar.y, 5);
      expect(bar(2).pill!.y).toBeGreaterThanOrEqual(0);
    });

    it('a missed day is a 12px stub on the baseline with a dash pill, never a connecting line', () => {
      const miss = bar(4);
      expect(miss.kind).toBe('missed');
      expect(miss.bar.h).toBe(12);
      expect(miss.bar.y + 12).toBeCloseTo(m.baseline, 5);
      expect(miss.pill!.text).toBe('–');
      expect(miss.pill!.dash).toBeTrue();
      expect(miss.title).toBe('No check-in · Day 4');
      expect(miss.aria).toContain('no check-in');
    });

    it('future days draw no bar but keep a (future) day label; today is flagged', () => {
      expect(m.days.map(d => d.day)).toEqual([1, 2, 3, 4, 5]);
      const l6 = m.labels.find(l => l.day === 6)!;
      expect(l6.future).toBeTrue();
      expect(m.labels.find(l => l.day === 5)!.today).toBeTrue();
      expect(m.labels.find(l => l.day === 3)!.future).toBeFalse();
    });

    it('limit line at the threshold with the "Alert ≥ 7" pill at x 0, 88 wide, 24 high, line starting after it', () => {
      const l = m.limit!;
      const y7 = m.pad.t + (1 - 0.7) * (m.h - m.pad.t - m.pad.b);
      expect(l.y).toBeCloseTo(y7, 5);
      expect(l.pill.x).toBe(0);
      expect(l.pill.w).toBe(88);
      expect(l.pill.h).toBe(24);
      expect(l.pill.text).toBe('Alert ≥ 7');
      expect(l.pill.y + 12).toBeCloseTo(y7, 5);
      expect(l.x1).toBe(88);
      expect(l.x2).toBe(640);
    });

    it('the y tick at the threshold is hidden when it would collide with the limit pill; others remain', () => {
      const labels = m.yTicks.map(t => t.label);
      expect(labels).toContain('0');
      expect(labels).toContain('10');
      // threshold 7 sits between ticks 6 and 8; 6 and 8 are > 14 px away from the pill centre here, so a tick exactly on the threshold is dropped
      const m6 = computeBars(inputs({ threshold: 6 }), 640);
      expect(m6.yTicks.map(t => t.label)).not.toContain('6');
      expect(m6.yTicks.map(t => t.label)).toContain('8');
    });

    it('rows list values and missed days in order with their status words', () => {
      expect(m.rows.map(r => r.status)).toEqual(['Below threshold', 'At or above alert threshold', 'Below threshold', 'No check-in', 'Below threshold']);
      expect(m.desc).toContain('4 check-ins over 7 days');
      expect(m.desc).toContain('1 missed days');
    });
  });

  it('without a threshold there is no limit, no alert bar and no pill is an alert', () => {
    const m = computeBars(inputs({ threshold: null }), 640);
    expect(m.limit).toBeNull();
    expect(m.alertCount).toBe(0);
    expect(m.days.every(d => !d.alert)).toBeTrue();
    expect(m.desc).toContain('No alert threshold defined.');
  });

  it('long follow-ups (narrow bands) drop pills except the last value and alerts, as 24px floating pills', () => {
    const days = Array.from({ length: 14 }, (_, i) => i + 1);
    const vals = days.map(d => (d === 4 ? 9 : 2));
    const m = computeBars(inputs({ points: pts(days, vals), totalDays: 30, todayDay: 14 }), 600);
    expect(m.band).toBeLessThan(40);
    expect(m.mode).toBe('floating');
    const withPill = m.days.filter(d => d.pill).map(d => d.day);
    expect(withPill).toEqual([4, 14]);
    const p = m.days.find(d => d.day === 4)!.pill!;
    expect(p.h).toBe(24);
    expect(p.w).toBeGreaterThanOrEqual(30);
    expect(p.w).toBeGreaterThanOrEqual(m.bw + 8);
    // labels thin out so neighbours are at least ~30px apart
    expect(m.labels.map(l => l.day)).toContain(1);
    expect(m.labels.map(l => l.day)).toContain(14);
    expect(m.labels.length).toBeLessThan(30);
  });

  it('compact: 96 high, limit pill "≥7" 30x18 at x 0, pills only for alerts and the latest value', () => {
    const m = computeBars(inputs({ variant: 'compact' }), 300);
    expect(m.h).toBe(96);
    expect(m.pad).toEqual({ l: 34, r: 0, t: 28, b: 4 });
    expect(m.limit!.pill.text).toBe('≥7');
    expect(m.limit!.pill.w).toBe(30);
    expect(m.limit!.pill.h).toBe(18);
    expect(m.limit!.pill.x).toBe(0);
    expect(m.limit!.x1).toBe(30);
    expect(m.labels.length).toBe(0);
    expect(m.days.filter(d => d.pill).map(d => d.day)).toEqual([2, 5]);
    const bar2 = m.days.find(d => d.day === 2)!;
    expect(bar2.bar.rx).toBeLessThanOrEqual(6);
    expect(bar2.pill!.h).toBe(20);
    expect(m.days.find(d => d.day === 4)!.kind).toBe('missed');
  });

  it('micro: 64x20, last 7 days as bars, no pills, no limit', () => {
    const m = computeBars(inputs({ variant: 'micro', points: pts([1, 2, 3], [3, 8, 5]), todayDay: 3 }), 999);
    expect(m.w).toBe(64);
    expect(m.h).toBe(20);
    expect(m.limit).toBeNull();
    expect(m.days.every(d => !d.pill)).toBeTrue();
    expect(m.days.length).toBe(3);
    expect(m.days.find(d => d.day === 2)!.alert).toBeTrue();
  });

  it('temperature bars start at 35 and clamp lower values to a zero-height bar', () => {
    const m = computeBars(inputs({ points: pts([1, 2], [34, 38.4]), domain: 'auto', unit: '°C', threshold: 38, todayDay: 2 }), 640);
    expect(m.domain[0]).toBe(35);
    expect(m.days[0].bar.h).toBe(0);
    expect(m.days[1].alert).toBeTrue();
    expect(m.limit!.pill.text).toBe('Alert ≥ 38°C');
    expect(m.yTicks[0].label).toBe('35');
  });

  it('day labels keep >= 30px between neighbours on narrow screens, always keep day 1 and the real current day (bold)', () => {
    const days = Array.from({ length: 14 }, (_, i) => i + 1);
    const m = computeBars(inputs({ points: pts(days.slice(0, 6), [1, 2, 3, 4, 5, 6]), totalDays: 14, todayDay: 5, nowDay: 6 }), 300);
    const xs = m.labels.map(l => l.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(29);
    }
    expect(m.labels[0].day).toBe(1);
    expect(m.labels.find(l => l.today)!.day).toBe(6);
    expect(m.labels.find(l => l.day === 9)!.future).toBeTrue();
  });

  describe('day 0 (discharge day)', () => {
    const d0 = () => inputs({ points: pts([0], [4]), todayDay: 0, nowDay: 1 });

    it('firstDay is 0 only when a value exists on day 0', () => {
      expect(firstDay(pts([0, 1]))).toBe(0);
      expect(firstDay(pts([1, 2]))).toBe(1);
      expect(firstDay([])).toBe(1);
    });

    it('full: the axis starts at D0, the day-0 bar sits at the left padding and carries the value', () => {
      const m = computeBars(d0(), 640);
      expect(m.band).toBeCloseTo((640 - 48) / 8, 5); // D0..D7 = 8 bands
      const b = m.days.find(x => x.day === 0)!;
      expect(b.kind).toBe('value');
      expect(b.value).toBe(4);
      expect(b.bar.x).toBeCloseTo(48 + m.gap / 2, 5);
      expect(b.bar.h).toBeGreaterThan(0);
      expect(m.labels[0].text).toBe('D0');
      expect(m.days.map(x => x.day)).not.toContain(1); // day 1 is still in the future, no stub
    });

    it('narrow screens: labels never touch; the real current day wins over D0', () => {
      const m = computeBars({ ...d0(), totalDays: 14 }, 300);
      const xs = m.labels.map(l => l.x);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(29);
      }
      expect(m.labels.find(l => l.today)!.day).toBe(1);
    });

    it('without a day-0 value the axis still starts at D1', () => {
      const m = computeBars(inputs(), 640);
      expect(m.labels[0].text).toBe('D1');
      expect(m.days.some(x => x.day === 0)).toBeFalse();
    });

    it('day 0 is never a missed day, even when other days are missed', () => {
      expect(missedDays(pts([0]), 3, 7)).toEqual([1, 2, 3]);
      const m = computeBars(inputs({ points: pts([0, 2], [4, 3]), todayDay: 3 }), 640);
      expect(m.days.filter(x => x.kind === 'missed').map(x => x.day)).toEqual([1, 3]);
      expect(m.rows.map(r => r.day)).toEqual([0, 1, 2, 3]);
    });

    it('compact and micro include day 0 too (same rule)', () => {
      for (const variant of ['compact', 'micro'] as const) {
        const m = computeBars({ ...d0(), variant }, 320);
        expect(m.days.find(x => x.day === 0)?.value).toBe(4);
        expect(m.days[0].bar.x).toBeCloseTo(m.pad.l + m.gap / 2, 5);
      }
    });

    it('dayWindow with startDay 0 keeps day 0 in short follow-ups and clamps long ones from 0', () => {
      expect(dayWindow('compact', 6, 1, 0)).toEqual({ start: 0, end: 6 });
      expect(dayWindow('compact', 30, 1, 0)).toEqual({ start: 0, end: 6 });
      expect(dayWindow('compact', 30, 1, 1)).toEqual({ start: 1, end: 7 });
    });
  });
});
