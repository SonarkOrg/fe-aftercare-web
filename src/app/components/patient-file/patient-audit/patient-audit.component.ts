import { Component, Input, OnInit } from '@angular/core';
import { AuditService } from '../../../Services/Audit.service';
import { enumKey } from '../../../i18n/enum-key';
import { fmtDate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { AuditEvent } from '../../../models/audit.model';

export const AUDIT_PAGE_SIZE = 50;

@Component({
  selector: 'app-patient-audit',
  templateUrl: './patient-audit.component.html'
})
export class PatientAuditComponent implements OnInit {
  @Input() patientId = 0;

  actorSub: string | null = null;
  events: AuditEvent[] = [];
  page = 0;
  hasMore = false;
  loading = true;
  error = false;

  constructor(private audit: AuditService, private i18n: I18nService) {}

  ngOnInit(): void {
    this.load(0);
  }

  /** yyyy-MM-dd HH:mm in America/Toronto. */
  when(iso: string): string {
    return fmtDate(iso, 'isoDateTime', this.i18n.lang);
  }

  item(e: AuditEvent): string {
    return this.i18n.t(enumKey('auditResource', e.resourceType)) + (e.resourceId !== null ? ` #${e.resourceId}` : '');
  }

  /** Changing the actor starts over at page 0. */
  setActor(sub: string | null): void {
    this.actorSub = sub;
    this.events = [];
    this.load(0);
  }

  load(page: number): void {
    this.error = false;
    if (page === 0) {
      this.loading = true;
    }
    this.audit.list(this.patientId, page, AUDIT_PAGE_SIZE, this.actorSub).subscribe({
      next: p => {
        this.events = page === 0 ? p.items : [...this.events, ...p.items];
        this.page = p.page;
        this.hasMore = p.hasMore;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = true;
      }
    });
  }
}
