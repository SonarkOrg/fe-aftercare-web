import { Component, OnInit } from '@angular/core';
import { AuditQuery, AuditService } from '../../../Services/Audit.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { enumKey } from '../../../i18n/enum-key';
import { fmtDate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { AUDIT_ACTIONS, AuditAction, AuditEvent } from '../../../models/audit.model';
import { addDays, businessToday } from '../../../shared/link.util';

export const ACCESS_LOG_PAGE_SIZE = 50;

/** The global access log (ADMIN): who did what, across every patient. */
@Component({
  selector: 'app-access-log',
  templateUrl: './access-log.component.html'
})
export class AccessLogComponent implements OnInit {
  readonly actions = AUDIT_ACTIONS;

  actorSub: string | null = null;
  action: AuditAction | '' = '';
  patientId: number | null = null;
  from = '';
  to = '';

  events: AuditEvent[] = [];
  page = 0;
  hasMore = false;
  loading = true;
  errorMessage: string | null = null;
  filterError: string | null = null;
  /** The query of the page being shown (Load more keeps it even if the form was edited). */
  private applied: AuditQuery = {};

  ngOnInit(): void {
    this.reset();
  }

  constructor(private audit: AuditService, private i18n: I18nService, private errors: ApiErrorsService) {}

  /** Back to "everyone, any action, last 30 days". */
  reset(): void {
    const today = businessToday();
    this.actorSub = null;
    this.action = '';
    this.patientId = null;
    this.from = addDays(today, -29);
    this.to = today;
    this.apply();
  }

  apply(): void {
    this.filterError = null;
    if (this.from && this.to && this.from > this.to) {
      this.filterError = this.i18n.t('settings.log.startAfterEnd');
      return;
    }
    if (this.from && this.to && (Date.parse(this.to) - Date.parse(this.from)) / 86_400_000 > 366) {
      this.filterError = this.i18n.t('error.field.rangeMax', { days: 366 });
      return;
    }
    const id = this.patientId;
    this.applied = {
      actorSub: this.actorSub, action: this.action || null,
      patientId: id !== null && id !== undefined && `${id}` !== '' ? Number(id) : null,
      from: this.from || null, to: this.to || null
    };
    this.events = [];
    this.load(0);
  }

  load(page: number): void {
    this.errorMessage = null;
    if (page === 0) {
      this.loading = true;
    }
    this.audit.listAll(this.applied, page, ACCESS_LOG_PAGE_SIZE).subscribe({
      next: p => {
        this.events = page === 0 ? p.items : [...this.events, ...p.items];
        this.page = p.page;
        this.hasMore = p.hasMore;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.errorMessage = this.errors.text(err, 'pf.audit.loadError');
      }
    });
  }

  retry(): void {
    this.load(this.events.length ? this.page + 1 : 0);
  }

  /** yyyy-MM-dd HH:mm in America/Toronto. */
  when(iso: string): string {
    return fmtDate(iso, 'isoDateTime', this.i18n.lang);
  }

  item(e: AuditEvent): string {
    return this.i18n.t(enumKey('auditResource', e.resourceType)) + (e.resourceId !== null ? ` #${e.resourceId}` : '');
  }
}
