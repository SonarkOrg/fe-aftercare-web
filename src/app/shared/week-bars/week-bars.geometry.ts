import { ChartText } from '../chart-text';

export type WbTone = 'neutral' | 'critical' | 'warning';

export interface WbCategory { label: string; from: string; to: string }
export interface WbSeries { key: string; label: string; tone: WbTone; glyph: string; values: (number | null)[] }

export interface WbInputs {
  categories: WbCategory[];
  series: WbSeries[];
  unit: string;
  max: number | 'auto';
  title: string;
}

export interface WbPill { x: number; y: number; w: number; h: number; rx: number; ty: number; fs: number; text: string }
export interface WbBar {
  key: string; tone: WbTone; cat: number; value: number | null;
  x: number; y: number; w: number; h: number; rx: number;
  /** A null value: a grey hatched stub with a dash, like a missed day. */
  miss: boolean;
  /** A zero value: nothing is drawn (no bar, no pill); the value stays in the table. */
  zero: boolean;
  pill: WbPill | null;
}
export interface WbModel {
  w: number; h: number; pad: { l: number; r: number; t: number; b: number };
  baseline: number; domainMax: number; step: number;
  yTicks: { y: number; label: string }[];
  labels: { x: number; y: number; text: string }[];
  bars: WbBar[];
  hidePills: boolean;
  title: string; desc: string;
  rows: { label: string; values: string[] }[];
}

export const WB_HEIGHT = 240;
export const WB_GAP = 6;
export const WB_PAD = { l: 44, r: 12, t: 30, b: 34 };
export const WB_STUB = 10;
export const WB_MAX_BAR = 56;
export const WB_PILL_H = 22;
export const WB_MANY = 16;


/** Rounds `v` up to a "nice" axis maximum (1, 2, 5 x 10^k steps, at most ~5 ticks). */
export function niceMax(v: number): { max: number; step: number } {
  if (!(v > 0)) {
    return { max: 4, step: 1 };
  }
  const raw = v / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  return { max: Math.ceil(v / step - 1e-9) * step, step };
}

export function computeWeekBars(inp: WbInputs, width: number, tx: ChartText): WbModel {
  /** "2026-10-05" -> "5 Oct" / "5 oct." (calendar date, no time zone involved). */
  const dMMM = (iso: string) => tx.date(iso, 'dateShort');
  const pad = WB_PAD;
  const w = Math.max(width, 240);
  const h = WB_HEIGHT;
  const baseline = h - pad.b;
  const plotH = baseline - pad.t;
  const plotW = w - pad.l - pad.r;
  const n = inp.categories.length;
  const ns = Math.max(inp.series.length, 1);

  let domainMax: number;
  let step: number;
  if (inp.max === 'auto') {
    const top = Math.max(0, ...inp.series.flatMap(s => s.values.filter((v): v is number => v !== null)));
    ({ max: domainMax, step } = niceMax(top * 1.15));
  } else {
    domainMax = inp.max;
    step = inp.max <= 10 ? 2 : inp.max / 4;
  }
  const yOf = (v: number) => baseline - (Math.min(Math.max(v, 0), domainMax) / domainMax) * plotH;

  const yTicks: { y: number; label: string }[] = [];
  for (let t = 0; t <= domainMax + 1e-9; t += step) {
    yTicks.push({ y: yOf(t), label: tx.num(Math.round(t * 100) / 100, '1.0-2') });
  }

  const hidePills = n > WB_MANY;
  const band = n > 0 ? plotW / n : plotW;
  const usable = Math.max(band - 2 * WB_GAP, 2);
  const barW = Math.min(WB_MAX_BAR, Math.max((usable - WB_GAP * (ns - 1)) / ns, 2));
  const groupW = barW * ns + WB_GAP * (ns - 1);

  const bars: WbBar[] = [];
  for (let c = 0; c < n; c++) {
    const gx = pad.l + band * c + (band - groupW) / 2;
    inp.series.forEach((s, si) => {
      const value = s.values[c] ?? null;
      const x = gx + si * (barW + WB_GAP);
      const miss = value === null;
      const zero = value === 0;
      const barH = miss ? WB_STUB : Math.max(value > 0 ? 2 : 0, baseline - yOf(value));
      const y = baseline - barH;
      let pill: WbPill | null = null;
      if (!hidePills && !zero) {
        const text = miss ? '–' : `${s.tone === 'neutral' ? '' : s.glyph + ' '}${tx.value(value as number, inp.unit)}`;
        const pw = Math.max(26, text.length * 8 + 12);
        // Narrow grouped bars would make neighbouring pills overlap: the value stays in the table instead.
        if (pw <= barW + WB_GAP || ns === 1) {
          pill = { x: x + barW / 2 - pw / 2, y: Math.max(y - WB_PILL_H - 4, 2), w: pw, h: WB_PILL_H, rx: WB_PILL_H / 2, ty: Math.max(y - WB_PILL_H - 4, 2) + 16, fs: 14, text };
        }
      }
      bars.push({ key: s.key, tone: s.tone, cat: c, value, x, y, w: barW, h: barH, rx: Math.min(8, barW / 2), miss, zero, pill });
    });
  }

  const every = n > WB_MANY ? Math.ceil(n / 8) : 1;
  const labels: { x: number; y: number; text: string }[] = [];
  inp.categories.forEach((cat, i) => {
    if (i % every === 0) {
      labels.push({ x: pad.l + band * i + band / 2, y: h - 10, text: n > WB_MANY ? dMMM(cat.from) : cat.label });
    }
  });

  const rows = inp.categories.map((cat, i) => ({
    label: tx.t('weekBars.range', { from: dMMM(cat.from), to: dMMM(cat.to) }),
    values: inp.series.map(s => (s.values[i] === null || s.values[i] === undefined ? '–' : tx.value(s.values[i] as number, inp.unit)))
  }));
  const first = inp.categories[0];
  const last = inp.categories[n - 1];
  const totals = inp.series.map(s => {
    const vals = s.values.filter((v): v is number => v !== null);
    return inp.unit === '%' ? s.label : `${tx.num(vals.reduce((a, b) => a + b, 0), '1.0-2')} ${s.label.toLowerCase()}`;
  });
  const desc = n
    ? tx.t(inp.unit === '%' ? 'weekBars.desc' : 'weekBars.descTotals', { title: inp.title, from: dMMM(first.from), to: dMMM(last.to), totals: totals.join(', ') })
    : inp.title;

  return { w, h, pad, baseline, domainMax, step, yTicks, labels, bars, hidePills, title: inp.title, desc, rows };
}
