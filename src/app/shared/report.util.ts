import { ReportSummary } from '../models/report.model';

export function pct(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)} %`;
}

export function minutes(m: number | null | undefined): string {
  if (m === null || m === undefined) {
    return '—';
  }
  if (m < 0) {
    return '—'; // defensive: a negative duration is bad data, not a time
  }
  const total = Math.round(m);
  if (total < 60) {
    return `${total} min`;
  }
  const mm = total % 60;
  return `${Math.floor(total / 60)} h ${mm < 10 ? '0' + mm : mm}`;
}

/** Quotes a cell and defuses spreadsheet formula injection: only STRINGS starting with = + - @ TAB or CR get a ' prefix (a negative number stays a number). */
function cell(v: string | number | null): string {
  let s = v === null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

const RATE_KEYS = new Set(['completionRate', 'questionnaireCompletionRate', 'needsReviewRate', 'cancellationRate', 'noShowRate']);

/** UTF-8 (with BOM), CRLF, every cell quoted. Metrics first, then one row per week. */
export function reportCsv(s: ReportSummary): string {
  const lines: string[] = [['Metric', 'Value'].map(cell).join(',')];
  for (const section of ['checkIns', 'followUps', 'alerts', 'appointments'] as const) {
    for (const [key, value] of Object.entries(s[section]) as [string, string | number | null][]) {
      const v = typeof value === 'number' && RATE_KEYS.has(key) ? value.toFixed(4) : value;
      lines.push([`${section}.${key}`, v].map(cell).join(','));
    }
  }
  lines.push('');
  lines.push(['Week start', 'From', 'To', 'Check-ins expected', 'Check-ins received', 'Alerts high', 'Alerts medium'].map(cell).join(','));
  for (const w of s.weeks) {
    lines.push([w.weekStart, w.from, w.to, w.checkInsExpected, w.checkInsReceived, w.alertsHigh, w.alertsMedium].map(cell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
