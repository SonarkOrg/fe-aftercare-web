import { testChartText } from '../../testing/i18n-testing.module';
import { WB_GAP, WB_STUB, WbCategory, WbSeries, computeWeekBars, niceMax } from './week-bars.geometry';

const text = testChartText('en');
const dMMM = (iso: string) => text.date(iso, 'dateShort');

const cats = (n: number): WbCategory[] => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 7 + i * 7));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { label: dMMM(iso(d)), from: iso(d), to: iso(new Date(d.getTime() + 6 * 86_400_000)) };
});
const two = (n: number, hi = 3, med = 4): WbSeries[] => [
  { key: 'high', label: 'High', tone: 'critical', glyph: '▲', values: Array(n).fill(hi) },
  { key: 'medium', label: 'Medium', tone: 'warning', glyph: '●', values: Array(n).fill(med) }
];

describe('week-bars geometry', () => {
  it('dMMM formats without a time zone', () => {
    expect(dMMM('2026-10-05')).toBe('5 Oct');
    expect(dMMM('2026-01-31')).toBe('31 Jan');
  });

  it('rounds the maximum up to a nice step', () => {
    expect(niceMax(0)).toEqual({ max: 4, step: 1 });
    expect(niceMax(3.45)).toEqual({ max: 4, step: 1 });
    expect(niceMax(4.6)).toEqual({ max: 6, step: 2 });
    expect(niceMax(9).max).toBe(10);
    expect(niceMax(23).max).toBe(30);
    expect(niceMax(80).max % niceMax(80).step).toBe(0);
    for (const v of [0.5, 1, 7, 13, 48, 99, 250, 1234]) {
      const n = niceMax(v);
      expect(n.max).toBeGreaterThanOrEqual(v);
      expect(n.max / n.step).toBeLessThanOrEqual(6);
    }
  });

  it('auto domain: max of the values times 1.15, rounded up', () => {
    const m = computeWeekBars({ categories: cats(3), series: two(3, 3, 4), unit: '', max: 'auto', title: 't' }, 560, text);
    expect(m.domainMax).toBeGreaterThanOrEqual(4.6);
    expect(m.domainMax).toBe(niceMax(4 * 1.15).max);
    expect(m.yTicks[0].label).toBe('0');
    expect(m.yTicks[m.yTicks.length - 1].label).toBe(String(m.domainMax));
  });

  it('a fixed max (100 for %) fixes the domain', () => {
    const s: WbSeries[] = [{ key: 'r', label: 'Completion', tone: 'neutral', glyph: '▨', values: [50, 100, null] }];
    const m = computeWeekBars({ categories: cats(3), series: s, unit: '%', max: 100, title: 't' }, 560, text);
    expect(m.domainMax).toBe(100);
    const full = m.bars[1];
    expect(full.y).toBeCloseTo(m.pad.t, 5); // 100 % reaches the top of the plot
    expect(m.bars[0].h).toBeCloseTo((m.baseline - m.pad.t) / 2, 5);
  });

  it('grouped bars sit side by side with the gap and never overlap, inside their band', () => {
    const m = computeWeekBars({ categories: cats(4), series: two(4), unit: '', max: 'auto', title: 't' }, 560, text);
    const band = (560 - m.pad.l - m.pad.r) / 4;
    for (let c = 0; c < 4; c++) {
      const [a, b] = m.bars.filter(x => x.cat === c);
      expect(a.x + a.w + WB_GAP).toBeCloseTo(b.x, 5);
      expect(a.x).toBeGreaterThanOrEqual(m.pad.l + band * c);
      expect(b.x + b.w).toBeLessThanOrEqual(m.pad.l + band * (c + 1));
    }
    const all = [...m.bars].sort((p, q) => p.x - q.x);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].x).toBeGreaterThanOrEqual(all[i - 1].x + all[i - 1].w);
    }
  });

  it('a null value draws a grey miss stub with a dash, not a zero bar', () => {
    const s: WbSeries[] = [{ key: 'r', label: 'Completion', tone: 'neutral', glyph: '▨', values: [null, 0] }];
    const m = computeWeekBars({ categories: cats(2), series: s, unit: '%', max: 100, title: 't' }, 560, text);
    expect(m.bars[0].miss).toBeTrue();
    expect(m.bars[0].h).toBe(WB_STUB);
    expect(m.bars[0].pill!.text).toBe('–');
    expect(m.bars[1].miss).toBeFalse();
    expect(m.bars[1].h).toBe(0);
    expect(m.bars[1].pill).toBeNull(); // a real 0 % gets no pill
    expect(m.bars[1].zero).toBeTrue();
    expect(m.rows[1].values).toEqual(['0%']); // ...but stays in the table
  });

  it('a zero value draws neither a bar nor a pill, in grouped and single series', () => {
    const grouped = computeWeekBars({ categories: cats(3), series: [
      { key: 'high', label: 'High', tone: 'critical', glyph: '▲', values: [0, 2, 0] },
      { key: 'medium', label: 'Medium', tone: 'warning', glyph: '●', values: [0, 0, 5] }
    ], unit: '', max: 'auto', title: 't' }, 560, text);
    const zeros = grouped.bars.filter(b => b.value === 0);
    expect(zeros.length).toBe(4);
    expect(zeros.every(b => b.zero && b.pill === null)).toBeTrue();
    const nonZero = grouped.bars.filter(b => b.value !== 0);
    expect(nonZero.every(b => !b.zero && b.pill !== null)).toBeTrue();
    expect(nonZero.map(b => b.pill!.text)).toEqual(['▲ 2', '● 5']);
    expect(grouped.rows).toEqual(jasmine.arrayContaining([
      jasmine.objectContaining({ values: ['0', '0'] }),
      jasmine.objectContaining({ values: ['2', '0'] }),
      jasmine.objectContaining({ values: ['0', '5'] })
    ]));
    const single = computeWeekBars({ categories: cats(2), series: [{ key: 'x', label: 'X', tone: 'neutral', glyph: '▨', values: [0, 3] }], unit: '', max: 'auto', title: 't' }, 560, text);
    expect(single.bars[0].zero).toBeTrue();
    expect(single.bars[0].pill).toBeNull();
    expect(single.bars[1].pill!.text).toBe('3');
  });

  it('a series of only zeros draws no bars or pills but keeps the table rows', () => {
    const m = computeWeekBars({ categories: cats(4), series: two(4, 0, 0), unit: '', max: 'auto', title: 't' }, 560, text);
    expect(m.bars.every(b => b.zero && b.pill === null)).toBeTrue();
    expect(m.rows.length).toBe(4);
    expect(m.rows.every(r => r.values.every(v => v === '0'))).toBeTrue();
  });

  it('pills carry the glyph for critical and warning, and the bare number for neutral', () => {
    const m = computeWeekBars({ categories: cats(2), series: two(2, 3, 4), unit: '', max: 'auto', title: 't' }, 560, text);
    expect(m.bars[0].pill!.text).toBe('▲ 3');
    expect(m.bars[1].pill!.text).toBe('● 4');
    const n = computeWeekBars({ categories: cats(1), series: [{ key: 'x', label: 'X', tone: 'neutral', glyph: '▨', values: [7] }], unit: '', max: 'auto', title: 't' }, 560, text);
    expect(n.bars[0].pill!.text).toBe('7');
  });

  it('more than 16 categories hide the pills and thin the labels to every ceil(n/8)-th as "d MMM"', () => {
    const many = computeWeekBars({ categories: cats(20), series: two(20), unit: '', max: 'auto', title: 't' }, 560, text);
    expect(many.hidePills).toBeTrue();
    expect(many.bars.every(b => b.pill === null)).toBeTrue();
    expect(many.labels.length).toBe(Math.ceil(20 / 3));
    expect(many.labels[0].text).toBe(dMMM(cats(20)[0].from));
    const few = computeWeekBars({ categories: cats(16), series: two(16), unit: '', max: 'auto', title: 't' }, 560, text);
    expect(few.hidePills).toBeFalse();
    expect(few.labels.length).toBe(16);
  });

  it('describes the chart and exposes a table row per week', () => {
    const m = computeWeekBars({ categories: cats(2), series: two(2, 1, 2), unit: '', max: 'auto', title: 'Alerts per week' }, 560, text);
    expect(m.desc).toBe('Alerts per week, 7 Sept to 20 Sept: 2 high, 4 medium');
    expect(m.rows).toEqual([{ label: '7 Sept to 13 Sept', values: ['1', '2'] }, { label: '14 Sept to 20 Sept', values: ['1', '2'] }]);
  });

  it('handles an empty range', () => {
    const m = computeWeekBars({ categories: [], series: two(0), unit: '', max: 'auto', title: 't' }, 560, text);
    expect(m.bars).toEqual([]);
  });
  it('at 390px grouped bars carry no value pills (they would overlap their neighbours); the table has the numbers', () => {
    for (const n of [6, 8, 12]) {
      const m = computeWeekBars({ categories: cats(n), series: two(n, 3, 4), unit: '', max: 'auto', title: 't' }, 390, text);
      expect(m.bars.length).toBe(2 * n);
      expect(m.bars.every(b => b.pill === null)).toBeTrue();
      expect(m.rows.length).toBe(n);
    }
  });

  it('a pill never exceeds its bar plus the gap when grouped, and single-series bars keep theirs', () => {
    const wide = computeWeekBars({ categories: cats(2), series: two(2, 3, 4), unit: '', max: 'auto', title: 't' }, 1200, text);
    for (const b of wide.bars) {
      expect(b.pill === null || b.pill.w <= b.w + WB_GAP).toBeTrue();
    }
    const single = computeWeekBars({ categories: cats(6), series: [two(6)[0]], unit: '', max: 'auto', title: 't' }, 390, text);
    expect(single.bars.every(b => b.pill !== null)).toBeTrue();
  });

  it('writes the dates in French', () => {
    const fr = testChartText('fr');
    const m = computeWeekBars({ categories: [{ label: 'x', from: '2026-10-12', to: '2026-10-18' }], series: [{ key: 'a', label: 'Élevée', tone: 'critical', glyph: '▲', values: [2] }], unit: '', max: 'auto', title: 'Alertes' }, 560, fr);
    expect(m.desc).toBe('Alertes, du 12 oct. au 18 oct.\u00a0: 2 élevée');
    expect(m.rows[0].label).toBe('du 12 oct. au 18 oct.');
  });
});
