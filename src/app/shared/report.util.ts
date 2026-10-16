import type { TKey } from '../i18n/i18n.types';
import { ReportSummary } from '../models/report.model';

/** Quotes a cell and defuses spreadsheet formula injection: only STRINGS starting with = + - @ TAB or CR get a ' prefix (a negative number stays a number). */
function cell(v: string | number | null): string {
  let s = v === null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

const RATE_KEYS = new Set(['completionRate', 'questionnaireCompletionRate', 'needsReviewRate', 'cancellationRate', 'noShowRate']);

/**
 * UTF-8 (with BOM), CRLF, every cell quoted. Metrics first, then one row per week. Only the two header rows are translated:
 * the metric keys, numbers (`.` decimal separator) and ISO dates are the same in every language, so a parser never cares who exported.
 */
export function reportCsv(s: ReportSummary, text: (key: TKey) => string): string {
  const lines: string[] = [[text('reports.csv.metric'), text('reports.csv.value')].map(cell).join(',')];
  for (const section of ['checkIns', 'followUps', 'alerts', 'appointments'] as const) {
    for (const [key, value] of Object.entries(s[section]) as [string, string | number | null][]) {
      const v = typeof value === 'number' && RATE_KEYS.has(key) ? value.toFixed(4) : value;
      lines.push([`${section}.${key}`, v].map(cell).join(','));
    }
  }
  lines.push('');
  lines.push([text('reports.csv.weekStart'), text('reports.csv.from'), text('reports.csv.to'), text('reports.csv.expected'), text('reports.csv.received'),
    text('reports.csv.alertsHigh'), text('reports.csv.alertsMedium')].map(cell).join(','));
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
