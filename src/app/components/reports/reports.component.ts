import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReportService } from '../../Services/Report.service';
import { ApiErrorsService } from '../../i18n/api-errors';
import { I18nService } from '../../i18n/i18n.service';
import { Msg } from '../../i18n/i18n.types';
import { apiErrorOf } from '../../models/api-error.model';
import { ReportSummary } from '../../models/report.model';
import { addDays, businessToday, daysBetween } from '../../shared/link.util';
import { downloadText, reportCsv } from '../../shared/report.util';
import { fmtDate } from '../../i18n/format';
import { WbCategory, WbSeries } from '../../shared/week-bars/week-bars.geometry';

export const PRESETS: { label: Msg; days: number }[] = [
  { label: { key: 'reports.preset.days', params: { count: 7 } }, days: 7 }, { label: { key: 'reports.preset.days', params: { count: 28 } }, days: 28 },
  { label: { key: 'reports.preset.days', params: { count: 90 } }, days: 90 }, { label: { key: 'reports.preset.months', params: { count: 12 } }, days: 365 }
];
export const MAX_DAYS = 366;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html'
})
export class ReportsComponent implements OnInit {
  readonly presets = PRESETS;
  readonly today = businessToday();
  /** Replaceable in tests (the real one triggers a browser download). */
  save: (name: string, text: string) => void = downloadText;

  from = addDays(this.today, -27);
  to = this.today;
  summary: ReportSummary | null = null;
  loading = true;
  error: string | null = null;
  rangeError: string | null = null;

  constructor(private reports: ReportService, private route: ActivatedRoute, private router: Router, private i18n: I18nService, private errors: ApiErrorsService) {}

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const from = q?.get('from');
    const to = q?.get('to');
    if (from && to && ISO.test(from) && ISO.test(to)) {
      this.from = from;
      this.to = to;
    }
    if (this.validate()) {
      this.load();
    } else {
      this.loading = false;
    }
  }

  get activePreset(): number | null {
    return this.to === this.today ? (PRESETS.find(p => addDays(this.today, -(p.days - 1)) === this.from)?.days ?? null) : null;
  }

  setPreset(days: number): void {
    this.to = this.today;
    this.from = addDays(this.today, -(days - 1));
    this.apply();
  }

  /** Same rules as the API: to >= from, at most 366 days (inclusive). */
  private validate(): boolean {
    this.rangeError = null;
    if (!ISO.test(this.from) || !ISO.test(this.to)) {
      this.rangeError = this.i18n.t('reports.range.invalid');
    } else if (this.to < this.from) {
      this.rangeError = this.i18n.t('error.field.toBeforeFrom');
    } else if (daysBetween(this.from, this.to) + 1 > MAX_DAYS) {
      this.rangeError = this.i18n.t('error.field.rangeMax', { days: MAX_DAYS });
    }
    return this.rangeError === null;
  }

  apply(): void {
    if (!this.validate()) {
      return;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: { from: this.from, to: this.to }, replaceUrl: true });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.reports.summary(this.from, this.to).subscribe({
      next: s => {
        this.summary = s;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        const f = apiErrorOf(err)?.fieldErrors ?? {};
        if (f['to'] || f['from']) {
          const msg = f['to'] ?? f['from'];
          this.rangeError = this.errors.fieldText(f['to'] ? 'to' : 'from', msg);
        } else {
          this.error = this.errors.text(err, 'reports.error.load');
        }
      }
    });
  }

  exportCsv(): void {
    const s = this.summary;
    if (s) {
      this.save(`aftercare-report-${s.from}-${s.to}.csv`, reportCsv(s, k => this.i18n.t(k)));
    }
  }

  /* ---------- chart inputs ---------- */

  get categories(): WbCategory[] {
    return (this.summary?.weeks ?? []).map(w => ({ label: fmtDate(w.from, 'dateShort', this.i18n.lang), from: w.from, to: w.to }));
  }

  get alertSeries(): WbSeries[] {
    const w = this.summary?.weeks ?? [];
    return [
      { key: 'high', label: this.i18n.t('enum.alertSeverity.HIGH'), tone: 'critical', glyph: '▲', values: w.map(x => x.alertsHigh) },
      { key: 'medium', label: this.i18n.t('enum.alertSeverity.MEDIUM'), tone: 'warning', glyph: '●', values: w.map(x => x.alertsMedium) }
    ];
  }

  get completionSeries(): WbSeries[] {
    const w = this.summary?.weeks ?? [];
    return [{ key: 'rate', label: this.i18n.t('reports.completion'), tone: 'neutral', glyph: '▨', values: w.map(x => (x.checkInsExpected > 0 ? Math.round((x.checkInsReceived / x.checkInsExpected) * 100) : null)) }];
  }

  get pastVisits(): number {
    const a = this.summary?.appointments;
    return a ? a.completed + a.noShow : 0;
  }
}
