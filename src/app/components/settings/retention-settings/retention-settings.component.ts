import { Component, OnInit } from '@angular/core';
import { RetentionService } from '../../../Services/Retention.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { fmtDate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { Msg, TKey } from '../../../i18n/i18n.types';
import { apiErrorOf } from '../../../models/api-error.model';
import { RetentionCounts, RetentionRun, RetentionSettings, RetentionSettingsRequest } from '../../../models/retention.model';
import { ChipSpec } from '../../../shared/status';

type Field = keyof RetentionSettingsRequest;

export const RETENTION_FIELDS: { key: Field; label: TKey; help?: TKey; min?: number }[] = [
  { key: 'closedFollowUpMonths', label: 'settings.ret.f.followUps' },
  { key: 'deletedDocumentMonths', label: 'settings.ret.f.documents', help: 'settings.ret.f.documentsHelp' },
  { key: 'messageMonths', label: 'settings.ret.f.messages' },
  { key: 'notificationMonths', label: 'settings.ret.f.notifications' },
  { key: 'auditMonths', label: 'settings.ret.f.audit', help: 'settings.ret.f.auditHelp', min: 12 }
];

export const COUNT_ROWS: { key: keyof RetentionCounts; label: TKey }[] = [
  { key: 'followUps', label: 'settings.ret.c.followUps' }, { key: 'checkIns', label: 'settings.ret.c.checkIns' }, { key: 'alerts', label: 'settings.ret.c.alerts' },
  { key: 'documents', label: 'settings.ret.c.documents' }, { key: 'messages', label: 'settings.ret.c.messages' }, { key: 'notifications', label: 'settings.ret.c.notifications' },
  { key: 'auditEvents', label: 'settings.ret.c.audit' }
];

export const PRIVACY_NOTICE: TKey = 'settings.ret.notice';

@Component({
  selector: 'app-retention-settings',
  templateUrl: './retention-settings.component.html'
})
export class RetentionSettingsComponent implements OnInit {
  readonly fields = RETENTION_FIELDS;
  readonly countRows = COUNT_ROWS;
  readonly notice = PRIVACY_NOTICE;
  readonly label = (k: TKey) => this.i18n.t(k);

  current: RetentionSettings | null = null;
  /** The month value of each row; `keep[f]` true means "keep indefinitely" (value ignored, sent as null). */
  values: Record<Field, number | null> = this.blank();
  keep: Record<Field, boolean> = { closedFollowUpMonths: true, deletedDocumentMonths: true, messageMonths: true, notificationMonths: true, auditMonths: true };
  errors: Partial<Record<Field, string>> = {};
  loadError: string | null = null;
  banner: string | null = null;
  saving = false;
  saved = false;
  confirming = false;

  dryRunning = false;
  dryError: string | null = null;
  dryResult: RetentionRun | null = null;

  runs: RetentionRun[] = [];
  runsError: string | null = null;

  constructor(private retention: RetentionService, public i18n: I18nService, private apiErrors: ApiErrorsService) {}

  private blank(): Record<Field, number | null> {
    return { closedFollowUpMonths: null, deletedDocumentMonths: null, messageMonths: null, notificationMonths: null, auditMonths: null };
  }

  ngOnInit(): void {
    this.load();
    this.loadRuns();
  }

  load(): void {
    this.loadError = null;
    this.retention.settings().subscribe({
      next: s => this.apply(s),
      error: err => (this.loadError = this.apiErrors.text(err, 'settings.ret.error.load'))
    });
  }

  loadRuns(): void {
    this.runsError = null;
    this.retention.runs().subscribe({
      next: r => (this.runs = r),
      error: err => (this.runsError = this.apiErrors.text(err, 'settings.ret.error.runs'))
    });
  }

  private apply(s: RetentionSettings): void {
    this.current = s;
    for (const f of RETENTION_FIELDS) {
      this.values[f.key] = s[f.key];
      this.keep[f.key] = s[f.key] === null;
    }
  }

  setKeep(f: Field, keep: boolean): void {
    this.keep[f] = keep;
    if (keep) {
      this.values[f] = null;
    }
    this.errors[f] = undefined;
    this.saved = false;
  }

  touch(): void {
    this.saved = false;
    this.confirming = false;
  }

  /** Sending a null for "keep indefinitely"; blank or invalid numbers are reported per row. */
  private request(): RetentionSettingsRequest | null {
    const out: RetentionSettingsRequest = { closedFollowUpMonths: null, deletedDocumentMonths: null, messageMonths: null, notificationMonths: null, auditMonths: null };
    const errors: Partial<Record<Field, string>> = {};
    for (const f of RETENTION_FIELDS) {
      if (this.keep[f.key]) {
        continue;
      }
      const v = this.values[f.key];
      if (v === null || v === undefined || (v as unknown) === '') {
        errors[f.key] = this.i18n.t('settings.ret.err.required');
      } else if (f.min && Number.isInteger(v) && v >= 1 && v < f.min) {
        errors[f.key] = this.i18n.t('error.field.monthsMin', { min: f.min });
      } else if (!Number.isInteger(v) || v < 1 || v > 1200) {
        errors[f.key] = this.i18n.t('error.field.monthsRange', { min: 1, max: 1200 });
      } else {
        out[f.key] = v;
      }
    }
    this.errors = errors;
    return Object.keys(errors).length ? null : out;
  }

  /** A period is shortened when it was indefinite or larger before. */
  shortens(req: RetentionSettingsRequest): boolean {
    const cur = this.current;
    return !!cur && RETENTION_FIELDS.some(f => {
      const next = req[f.key];
      const old = cur[f.key];
      return next !== null && (old === null || next < old);
    });
  }

  save(): void {
    if (!this.current || this.saving) {
      return;
    }
    this.saved = false;
    this.banner = null;
    const req = this.request();
    if (!req) {
      return;
    }
    if (this.shortens(req) && !this.confirming) {
      this.confirming = true;
      return;
    }
    this.confirming = false;
    this.send(req);
  }

  confirmSave(): void {
    this.confirming = false;
    const req = this.request();
    if (req) {
      this.send(req);
    }
  }

  private send(req: RetentionSettingsRequest): void {
    this.saving = true;
    this.retention.save(req).subscribe({
      next: s => {
        this.saving = false;
        this.saved = true;
        this.apply(s);
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (api && Object.keys(api.fieldErrors).length) {
          this.errors = this.apiErrors.fieldTexts(err) as Partial<Record<Field, string>>;
        } else {
          this.banner = this.apiErrors.text(err, 'settings.ret.error.save');
        }
      }
    });
  }

  dryRun(): void {
    this.dryRunning = true;
    this.dryError = null;
    this.dryResult = null;
    this.retention.dryRun().subscribe({
      next: r => {
        this.dryRunning = false;
        this.dryResult = r;
        this.loadRuns();
      },
      error: err => {
        this.dryRunning = false;
        this.dryError = this.apiErrors.text(err, 'settings.ret.error.dry');
      }
    });
  }

  /* ---------- display ---------- */

  /** The automatic purge state, from the two server flags. */
  get purgeStatus(): { text: string; chip: ChipSpec } | null {
    const s = this.current;
    if (!s) {
      return null;
    }
    if (!s.purgeEnabled) {
      return { text: this.i18n.t('settings.ret.purgeOff'), chip: { tone: 'neutral', glyph: '—', label: { key: 'settings.ret.purgeOff' } } };
    }
    if (s.dryRun) {
      return { text: this.i18n.t('settings.ret.purgeDry'), chip: { tone: 'warning', glyph: '●', label: { key: 'settings.ret.purgeDry' } } };
    }
    const m: Msg = { key: 'settings.ret.purgeOn' };
    return { text: this.i18n.t(m), chip: { tone: 'critical', glyph: '▲', label: m } };
  }

  total(c: RetentionCounts): number {
    return COUNT_ROWS.reduce((n, r) => n + (c[r.key] ?? 0), 0);
  }

  when(iso: string): string {
    return fmtDate(iso, 'isoDateTime', this.i18n.lang);
  }

  detail(c: RetentionCounts): string {
    return COUNT_ROWS.map(r => `${this.i18n.t(r.label)}${this.i18n.lang === 'fr' ? '\u00a0' : ''}: ${c[r.key]}`).join(', ');
  }

  statusChip(r: RetentionRun): ChipSpec {
    return r.status === 'SUCCEEDED' ? { tone: 'good', glyph: '✓', label: { key: 'enum.retentionRunStatus.SUCCEEDED' } } : { tone: 'critical', glyph: '▲', label: { key: 'enum.retentionRunStatus.FAILED' } };
  }
}
