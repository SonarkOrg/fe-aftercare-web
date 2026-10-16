import { SeriesPoint } from '../care.model';
import { ChartText } from '../chart-text';
import { addDays } from '../link.util';

export type Variant = 'full' | 'compact' | 'micro';

export interface Pad { l: number; r: number; t: number; b: number }

export interface ChartInputs {
  points: SeriesPoint[];
  totalDays: number;
  threshold: number | null;
  label: string;
  unit: string;
  domain: [number, number] | 'auto';
  variant: Variant;
  todayDay: number | null;
  /** The real current follow-up day (bold label, future shading) when `todayDay` is capped for missed-day purposes. */
  nowDay?: number | null;
}

/** Fixed heights; the width is measured (micro is always 64 wide). */
export const HEIGHT: Record<Variant, number> = { full: 280, compact: 96, micro: 20 };
export const MICRO_W = 64;
export const BASELINE_TEMP = 35;
export const STUB_H = 12;
export const LIMIT_PILL_FULL_W = 88;
export const LIMIT_PILL_COMPACT_W = 30;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function yDomain(inputs: Pick<ChartInputs, 'points' | 'threshold' | 'domain'>): [number, number] {
  if (inputs.domain !== 'auto') {
    return inputs.domain;
  }
  const values = inputs.points.filter(p => p.value !== null).map(p => p.value as number);
  const extra = inputs.threshold === null ? [] : [inputs.threshold];
  const top = values.length || extra.length ? Math.ceil(Math.max(...values, ...extra)) + 0.5 : 0;
  return [BASELINE_TEMP, Math.max(39.5, top)];
}

export function yTicks(domain: [number, number], isPain: boolean): number[] {
  const out: number[] = [];
  if (isPain) {
    for (let t = 0; t <= 10; t += 2) {
      if (t >= domain[0] && t <= domain[1]) {
        out.push(t);
      }
    }
    return out;
  }
  for (let t = Math.ceil(domain[0]); t <= domain[1]; t += 1) {
    out.push(t);
  }
  return out;
}

export function isAlert(v: number, threshold: number | null): boolean {
  return threshold !== null && v >= threshold;
}

/** Days in [1, min(todayDay, totalDays)] that have no point. */
export function missedDays(points: SeriesPoint[], todayDay: number | null, totalDays: number): number[] {
  if (todayDay === null) {
    return [];
  }
  const have = new Set(points.filter(p => p.value !== null).map(p => p.day));
  const out: number[] = [];
  for (let d = 1; d <= Math.min(todayDay, totalDays); d++) {
    if (!have.has(d)) {
      out.push(d);
    }
  }
  return out;
}

/** First drawn day: 0 (discharge day) when a value exists there, otherwise 1. Same rule for every variant. */
export function firstDay(points: SeriesPoint[]): 0 | 1 {
  return points.some(p => p.value !== null && p.day === 0) ? 0 : 1;
}

/**
 * Which follow-up days are drawn: all of them (full), or at most 7 around "today" (compact, micro).
 * Day 0 (discharge day) is included only when `startDay` is 0; it is never a missed day.
 */
export function dayWindow(variant: Variant, totalDays: number, anchor: number, startDay: 0 | 1 = 1): { start: number; end: number } {
  if (variant === 'full' || totalDays - startDay + 1 <= 7) {
    return { start: startDay, end: totalDays };
  }
  const start = clamp(anchor - 6, startDay, totalDays - 6);
  return { start, end: start + 6 };
}

export interface Pill {
  x: number; y: number; w: number; h: number; rx: number; text: string; unit: string; alert: boolean; dash: boolean; fs: number; ty: number;
}

export interface DayModel {
  kind: 'value' | 'missed';
  day: number; date: string; value: number | null; alert: boolean;
  band: { x: number; w: number };
  bar: { x: number; y: number; w: number; h: number; rx: number };
  pill: Pill | null;
  focus: { x: number; y: number; w: number; h: number };
  tip: { x: number; y: number };
  aria: string;
  title: string;
}

export interface DayLabel { day: number; x: number; y: number; text: string; today: boolean; future: boolean }

export interface TableRow { day: number; date: string; value: string; status: string }

export interface BarModel {
  w: number; h: number; pad: Pad; domain: [number, number];
  band: number; bw: number; gap: number;
  mode: 'pills' | 'floating' | 'none';
  baseline: number;
  yTicks: { y: number; label: string }[];
  days: DayModel[];
  labels: DayLabel[];
  limit: { y: number; x1: number; x2: number; pill: { x: number; y: number; w: number; h: number; rx: number; text: string; fs: number; ty: number } } | null;
  alertCount: number;
  title: string; desc: string; summary: string;
  rows: TableRow[];
  hasThreshold: boolean;
}

export function computeBars(inputs: ChartInputs, width: number, text: ChartText): BarModel {
  const fmt = (n: number) => text.num(round2(n), '1.0-2');
  const { variant, unit, threshold, label } = inputs;
  const total = Math.max(inputs.totalDays, 1);
  const points = inputs.points.filter(p => p.value !== null).sort((a, b) => a.day - b.day);
  const byDay = new Map(points.map(p => [p.day, p]));
  const lastPoint = points.length ? points[points.length - 1] : null;
  const domain = yDomain(inputs);
  const isPain = inputs.domain !== 'auto';
  const full = variant === 'full';
  const micro = variant === 'micro';
  const W = micro ? MICRO_W : Math.max(Math.round(width), 160);
  const H = HEIGHT[variant];

  const anchor = Math.max(inputs.todayDay ?? 0, lastPoint ? lastPoint.day : 0, 1);
  const startDay = firstDay(points);
  const win = dayWindow(variant, total, anchor, startDay);
  const n = win.end - win.start + 1;

  // horizontal metrics first: they decide whether every bar can carry a value pill
  const padL = full ? 48 : variant === 'compact' ? 34 : 2;
  const padR = micro ? 2 : 0;
  const band = (W - padL - padR) / n;
  const gap = full ? clamp(band * 0.1, 4, 8) : micro ? 2 : clamp(band * 0.12, 2, 6);
  const bw = band - gap;
  const mode: BarModel['mode'] = micro ? 'none' : full && band >= 40 ? 'pills' : 'floating';
  const pillH = mode === 'pills' ? (band >= 56 ? 36 : 28) : variant === 'compact' ? 20 : 24;
  const pad: Pad = full
    ? { l: padL, r: 0, t: pillH + 6, b: 32 }
    : variant === 'compact' ? { l: padL, r: 0, t: 28, b: 4 } : { l: 2, r: 2, t: 2, b: 2 };
  const plotH = H - pad.t - pad.b;
  const Y = (v: number) => pad.t + (1 - (clamp(v, domain[0], domain[1]) - domain[0]) / (domain[1] - domain[0])) * plotH;
  const base = Y(domain[0]);
  const X = (d: number) => pad.l + (d - win.start) * band + gap / 2;
  const radius = full ? 12 : variant === 'compact' ? 6 : 2;

  const startDate = points.length ? addDays(points[0].date, -points[0].day) : null; // date of day 0
  const dateOf = (d: number) => (byDay.get(d)?.date ?? (startDate ? addDays(startDate, d) : ''));
  const alertAt = (v: number) => isAlert(v, threshold);
  const thr = threshold !== null && threshold >= domain[0] && threshold <= domain[1] ? threshold : null;

  // limit line + pill (drawn first and last by the template, so pills never hide behind bars)
  let limit: BarModel['limit'] = null;
  if (thr !== null && !micro) {
    const ty = Y(thr);
    const pw = full ? LIMIT_PILL_FULL_W : LIMIT_PILL_COMPACT_W;
    const ph = full ? 24 : 18;
    const fs = full ? 13 : 11;
    limit = {
      y: ty, x1: pw, x2: W - pad.r,
      pill: { x: 0, y: ty - ph / 2, w: pw, h: ph, rx: ph / 2, text: full ? text.t('chart.limit.full', { value: text.value(round2(thr), unit) }) : text.t('chart.limit.compact', { value: fmt(thr) }), fs, ty: ty + fs * 0.36 }
    };
  }

  const ticks = full ? yTicks(domain, isPain) : [];
  const tickModels = ticks
    .map(t => ({ y: Y(t), label: fmt(t) }))
    .filter(t => !limit || Math.abs(t.y - limit.y) >= 14);

  const todayDay = inputs.todayDay;
  const missed = new Set(variant === 'micro' ? [] : missedDays(points, todayDay, total));
  const lastDay = lastPoint ? lastPoint.day : -1;
  const days: DayModel[] = [];
  const labels: DayLabel[] = [];

  // at least ~30px per day label so neighbours never touch; day 1 and today are always labelled
  const labelEvery = Math.max(1, Math.ceil(30 / band));
  const nowDay = inputs.nowDay ?? todayDay;
  const horizonDay = nowDay ?? (lastPoint ? lastPoint.day : 0);

  for (let d = win.start; d <= win.end; d++) {
    const x = X(d);
    const cx = x + bw / 2;
    const isToday = nowDay !== null && d === nowDay;
    const regular = (d - startDay) % labelEvery === 0 && !(nowDay !== null && d !== nowDay && Math.abs(d - nowDay) < labelEvery);
    if (full && (isToday || regular || (d === startDay && !(nowDay !== null && Math.abs(d - nowDay) < labelEvery)))) {
      labels.push({ day: d, x: cx, y: H - 6, text: text.t('chart.dayLabel', { day: d }), today: isToday, future: d > horizonDay });
    }
    const p = byDay.get(d);
    const dateText = dateOf(d);
    const dateAria = dateText ? text.date(dateText, 'isoDate') : '';
    if (p) {
      const v = p.value as number;
      const al = alertAt(v);
      const top = Y(v);
      const h = Math.max(base - top, 0);
      const showPill = mode === 'pills' || (mode === 'floating' && (al || d === lastDay));
      let pill: Pill | null = null;
      if (showPill) {
        const pw = mode === 'pills' ? bw : Math.max(bw + 8, 30);
        const fs = mode === 'pills' ? 15 : variant === 'compact' ? 12 : 13;
        const py = top - 4 - pillH;
        pill = {
          x: cx - pw / 2, y: py, w: pw, h: pillH, rx: pillH / 2, text: (al ? '▲ ' : '') + fmt(v),
          unit: mode === 'pills' && unit && bw >= 64 ? unit : '', alert: al, dash: false, fs, ty: py + pillH / 2 + fs * 0.36
        };
      }
      const fy = (pill ? pill.y : top) - 3;
      days.push({
        kind: 'value', day: d, date: p.date, value: v, alert: al,
        band: { x: pad.l + (d - win.start) * band, w: band },
        bar: { x, y: top, w: bw, h, rx: Math.min(radius, bw / 2, h / 2) },
        pill,
        focus: { x: x - 3, y: fy, w: bw + 6, h: base - fy + 3 },
        tip: { x: cx, y: pill ? pill.y : top },
        aria: text.t(dateAria ? (al ? 'chart.aria.dayAlertDate' : 'chart.aria.dayDate') : (al ? 'chart.aria.dayAlert' : 'chart.aria.day'), { day: d, date: dateAria, value: text.value(round2(v), unit) }),
        title: ''
      });
    } else if (missed.has(d)) {
      const top = base - STUB_H;
      let pill: Pill | null = null;
      if (mode === 'pills') {
        const py = top - 4 - pillH;
        pill = { x, y: py, w: bw, h: pillH, rx: pillH / 2, text: '–', unit: '', alert: false, dash: true, fs: 15, ty: py + pillH / 2 + 15 * 0.36 };
      }
      const fy = (pill ? pill.y : top) - 3;
      days.push({
        kind: 'missed', day: d, date: dateText, value: null, alert: false,
        band: { x: pad.l + (d - win.start) * band, w: band },
        bar: { x, y: top, w: bw, h: STUB_H, rx: Math.min(6, bw / 2) },
        pill,
        focus: { x: x - 3, y: fy, w: bw + 6, h: base - fy + 3 },
        tip: { x: cx, y: pill ? pill.y : top },
        aria: text.t(dateAria ? 'chart.aria.missedDate' : 'chart.aria.missed', { day: d, date: dateAria }),
        title: text.t('chart.missedTitle', { day: d })
      });
    }
  }

  const alertCount = points.filter(p => alertAt(p.value as number)).length;
  const missedAll = missedDays(points, inputs.todayDay, total);
  const latest = lastPoint ? text.t('chart.desc.latest', { value: text.value(lastPoint.value as number, unit), day: lastPoint.day }) : text.t('chart.desc.noCheckIns');
  const thrText = threshold !== null
    ? text.t('chart.desc.aboveThreshold', { count: alertCount, threshold: text.value(threshold, unit) })
    : text.t('chart.desc.noThreshold');
  const desc = [text.t('chart.desc.counts', { count: points.length, days: total }), latest, thrText, text.t('chart.desc.missed', { count: missedAll.length })].join(' ');

  const lastN = points.slice(-5).map(p => text.num(p.value as number, '1.0-2'));
  const summary = lastPoint
    ? text.t(threshold === null ? 'chart.summary.plain' : alertAt(lastPoint.value as number) ? 'chart.summary.above' : 'chart.summary.below', {
      label, count: lastN.length, values: lastN.join(', '), value: text.value(lastPoint.value as number, unit), threshold: threshold === null ? '' : text.num(threshold, '1.0-2')
    })
    : text.t('chart.summary.empty', { label });

  const rows: TableRow[] = [
    ...points.map(p => ({
      day: p.day, date: p.date, value: text.value(p.value as number, unit),
      status: text.t(threshold === null ? 'chart.status.noThreshold' : alertAt(p.value as number) ? 'chart.status.above' : 'chart.status.below')
    })),
    ...missedAll.map(d => ({ day: d, date: dateOf(d), value: '—', status: text.t('chart.status.missed') }))
  ].sort((a, b) => a.day - b.day);

  return {
    w: W, h: H, pad, domain, band, bw, gap, mode, baseline: base, yTicks: tickModels, days, labels, limit,
    alertCount, title: text.t('chart.title', { label }), desc, summary, rows, hasThreshold: threshold !== null
  };
}
