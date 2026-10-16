import { Component, OnInit } from '@angular/core';
import { RetentionService } from '../../../Services/Retention.service';
import { apiErrorOf, errorText } from '../../../models/api-error.model';
import { RetentionCounts, RetentionRun, RetentionSettings, RetentionSettingsRequest } from '../../../models/retention.model';
import { businessNow } from '../../../shared/link.util';
import { ChipSpec } from '../../../shared/status';

type Field = keyof RetentionSettingsRequest;

export const RETENTION_FIELDS: { key: Field; label: string; help?: string; min?: number }[] = [
  { key: 'closedFollowUpMonths', label: 'Closed or expired follow-ups (with their check-ins and alerts)' },
  { key: 'deletedDocumentMonths', label: 'Documents marked deleted', help: 'Active documents are never purged automatically.' },
  { key: 'messageMonths', label: 'Patient messages' },
  { key: 'notificationMonths', label: 'Notification history' },
  { key: 'auditMonths', label: 'Access log', help: 'Applies only to access-log entries; other purges never delete them.', min: 12 }
];

export const COUNT_ROWS: { key: keyof RetentionCounts; label: string }[] = [
  { key: 'followUps', label: 'Follow-ups' }, { key: 'checkIns', label: 'Check-ins' }, { key: 'alerts', label: 'Alerts' },
  { key: 'documents', label: 'Documents' }, { key: 'messages', label: 'Messages' }, { key: 'notifications', label: 'Notifications' },
  { key: 'auditEvents', label: 'Access-log entries' }
];

export const PRIVACY_NOTICE = "Retention periods must be set by the clinic's privacy officer (responsable de la protection des renseignements personnels) according to your retention schedule. The app does not assume any legal period. Empty = keep indefinitely.";

@Component({
  selector: 'app-retention-settings',
  templateUrl: './retention-settings.component.html'
})
export class RetentionSettingsComponent implements OnInit {
  readonly fields = RETENTION_FIELDS;
  readonly countRows = COUNT_ROWS;
  readonly notice = PRIVACY_NOTICE;

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

  constructor(private retention: RetentionService) {}

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
      error: err => (this.loadError = errorText(err, 'Could not load the retention settings.'))
    });
  }

  loadRuns(): void {
    this.runsError = null;
    this.retention.runs().subscribe({
      next: r => (this.runs = r),
      error: err => (this.runsError = errorText(err, 'Could not load the recent runs.'))
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
        errors[f.key] = 'Enter a number of months, or keep indefinitely.';
      } else if (f.min && Number.isInteger(v) && v >= 1 && v < f.min) {
        errors[f.key] = `must be at least ${f.min} months`;
      } else if (!Number.isInteger(v) || v < 1 || v > 1200) {
        errors[f.key] = 'must be between 1 and 1200 months';
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
          this.errors = { ...api.fieldErrors } as Partial<Record<Field, string>>;
        } else {
          this.banner = errorText(err, 'Could not save the retention settings.');
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
        this.dryError = errorText(err, 'Could not run the preview.');
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
      return { text: 'Automatic purge: off (server setting)', chip: { tone: 'neutral', glyph: '—', label: 'Automatic purge: off (server setting)' } };
    }
    if (s.dryRun) {
      return { text: 'Automatic purge: dry run only (nothing is deleted)', chip: { tone: 'warning', glyph: '●', label: 'Automatic purge: dry run only (nothing is deleted)' } };
    }
    const t = 'Automatic purge: ON: data older than these periods is deleted nightly at 03:15';
    return { text: t, chip: { tone: 'critical', glyph: '▲', label: t } };
  }

  total(c: RetentionCounts): number {
    return COUNT_ROWS.reduce((n, r) => n + (c[r.key] ?? 0), 0);
  }

  when(iso: string): string {
    return businessNow(new Date(iso)).slice(0, 16).replace('T', ' ');
  }

  detail(c: RetentionCounts): string {
    return COUNT_ROWS.map(r => `${r.label}: ${c[r.key]}`).join(', ');
  }

  statusChip(r: RetentionRun): ChipSpec {
    return r.status === 'SUCCEEDED' ? { tone: 'good', glyph: '✓', label: 'Succeeded' } : { tone: 'critical', glyph: '▲', label: 'Failed' };
  }
}
