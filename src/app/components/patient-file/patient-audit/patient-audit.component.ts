import { Component, Input, OnInit } from '@angular/core';
import { AuditService } from '../../../Services/Audit.service';
import { AuditEvent } from '../../../models/audit.model';
import { businessNow, humanize } from '../../../shared/link.util';

export const AUDIT_PAGE_SIZE = 50;

@Component({
  selector: 'app-patient-audit',
  templateUrl: './patient-audit.component.html'
})
export class PatientAuditComponent implements OnInit {
  @Input() patientId = 0;

  events: AuditEvent[] = [];
  page = 0;
  hasMore = false;
  loading = true;
  error = false;
  readonly humanize = humanize;

  constructor(private audit: AuditService) {}

  ngOnInit(): void {
    this.load(0);
  }

  /** yyyy-MM-dd HH:mm in America/Toronto. */
  when(iso: string): string {
    return businessNow(new Date(iso)).slice(0, 16).replace('T', ' ');
  }

  item(e: AuditEvent): string {
    return humanize(e.resourceType) + (e.resourceId !== null ? ` #${e.resourceId}` : '');
  }

  load(page: number): void {
    this.error = false;
    if (page === 0) {
      this.loading = true;
    }
    this.audit.list(this.patientId, page, AUDIT_PAGE_SIZE).subscribe({
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
