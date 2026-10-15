import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReportService } from '../../Services/Report.service';
import { apiErrorOf } from '../../models/api-error.model';
import { ReportSummary } from '../../models/report.model';
import { addDays, businessToday, daysBetween } from '../../shared/link.util';
import { downloadText, minutes, pct, reportCsv } from '../../shared/report.util';
import { WbCategory, WbSeries, dMMM } from '../../shared/week-bars/week-bars.geometry';

export const PRESETS: { label: string; days: number }[] = [
  { label: '7 days', days: 7 }, { label: '28 days', days: 28 }, { label: '90 days', days: 90 }, { label: '12 months', days: 365 }
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
  readonly pct = pct;
  readonly minutes = minutes;
  /** Replaceable in tests (the real one triggers a browser download). */
  save: (name: string, text: string) => void = downloadText;

  from = addDays(this.today, -27);
  to = this.today;
  summary: ReportSummary | null = null;
  loading = true;
  error: string | null = null;
  rangeError: string | null = null;

  constructor(private reports: ReportService, private route: ActivatedRoute, private router: Router) {}

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
      this.rangeError = 'Enter a valid start and end date.';
    } else if (this.to < this.from) {
      this.rangeError = 'The end date must not be before the start date.';
    } else if (daysBetween(this.from, this.to) + 1 > MAX_DAYS) {
      this.rangeError = 'The range must not exceed 366 days.';
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
          this.rangeError = f['to']?.includes('before') ? 'The end date must not be before the start date.'
            : f['to']?.includes('exceed') ? 'The range must not exceed 366 days.' : 'Enter a valid start and end date.';
        } else {
          this.error = 'Could not load the report.';
        }
      }
    });
  }

  exportCsv(): void {
    const s = this.summary;
    if (s) {
      this.save(`aftercare-report-${s.from}-to-${s.to}.csv`, reportCsv(s));
    }
  }

  /* ---------- chart inputs ---------- */

  get categories(): WbCategory[] {
    return (this.summary?.weeks ?? []).map(w => ({ label: dMMM(w.from), from: w.from, to: w.to }));
  }

  get alertSeries(): WbSeries[] {
    const w = this.summary?.weeks ?? [];
    return [
      { key: 'high', label: 'High', tone: 'critical', glyph: '▲', values: w.map(x => x.alertsHigh) },
      { key: 'medium', label: 'Medium', tone: 'warning', glyph: '●', values: w.map(x => x.alertsMedium) }
    ];
  }

  get completionSeries(): WbSeries[] {
    const w = this.summary?.weeks ?? [];
    return [{ key: 'rate', label: 'Completion', tone: 'neutral', glyph: '▨', values: w.map(x => (x.checkInsExpected > 0 ? Math.round((x.checkInsReceived / x.checkInsExpected) * 100) : null)) }];
  }

  get pastVisits(): number {
    const a = this.summary?.appointments;
    return a ? a.completed + a.noShow : 0;
  }
}
