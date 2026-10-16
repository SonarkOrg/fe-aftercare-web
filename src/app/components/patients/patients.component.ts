import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CareDataService } from '../../Services/CareData.service';
import { PatientService } from '../../Services/Patient.service';
import { Permissions } from '../../auth/permissions.service';
import { Patient } from '../../models/patient.model';
import { CareSnapshot, PatientRow, PatientStatus, SeriesPoint } from '../../shared/care.model';
import { addDays, businessToday, humanize, relativeDay } from '../../shared/link.util';
import { STATUS_RANK } from '../../shared/patient-status';
import { GLYPH, patientStatusChip } from '../../shared/status';

export type StatusFilter = 'all' | 'critical' | 'attention' | 'stable' | 'inactive';
export type SortKey = 'patient' | 'status' | 'followUp' | 'lastCheckIn' | 'pain' | 'alerts' | 'next';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'patient', label: 'Name' },
  { key: 'lastCheckIn', label: 'Last check-in' },
  { key: 'pain', label: 'Pain' },
  { key: 'alerts', label: 'Open alerts' },
  { key: 'next', label: 'Next appointment' }
];

const FILTERS: { key: StatusFilter; label: string; glyph: string; status?: PatientStatus }[] = [
  { key: 'all', label: 'All', glyph: '' },
  { key: 'critical', label: 'Critical', glyph: GLYPH.critical, status: 'CRITICAL' },
  { key: 'attention', label: 'Needs attention', glyph: GLYPH.warning, status: 'ATTENTION' },
  { key: 'stable', label: 'Stable', glyph: GLYPH.good, status: 'STABLE' },
  { key: 'inactive', label: 'Inactive', glyph: GLYPH.neutral, status: 'INACTIVE' }
];

export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function emptyPatient(): Patient {
  return { firstName: '', lastName: '', email: '', phone: '', gender: 'male', dateOfBirth: null, address: { city: '', state: '', zip: '' } };
}

@Component({
  selector: 'app-patients',
  templateUrl: './patients.component.html'
})
export class PatientsComponent implements OnInit, OnDestroy {
  patient: Patient = emptyPatient();
  rows: PatientRow[] = [];
  today = '';
  /** Latest selectable date of birth: yesterday in the clinic's time zone. */
  readonly dobMax = addDays(businessToday(), -1);
  loading = true;
  errorMessage: string | null = null;
  actionError: string | null = null;
  notice: string | null = null;
  saving = false;
  addError: string | null = null;
  drawerOpen = false;

  /** Status, follow-up and alert data exist only with CLINICAL_READ (the server sends them as null otherwise). */
  clinical = false;
  filters = FILTERS;
  sortOptions = SORT_OPTIONS;
  statusFilter: StatusFilter = 'all';
  query = '';
  sortKey: SortKey = 'status';
  sortDir: 'asc' | 'desc' = 'asc';

  humanize = humanize;
  relativeDay = relativeDay;
  chipOf = patientStatusChip;

  @ViewChild('drawerEl') drawerEl?: ElementRef<HTMLElement>;
  private trigger: HTMLElement | null = null;
  private sub = new Subscription();
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private care: CareDataService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    public permissions: Permissions
  ) {}

  ngOnInit(): void {
    this.clinical = this.permissions.can('CLINICAL_READ');
    if (!this.clinical) {
      this.sortOptions = SORT_OPTIONS.filter(o => o.key === 'patient' || o.key === 'next');
      this.sortKey = 'patient';
    }
    this.sub.add(this.route.queryParamMap.subscribe(q => {
      const status = q.get('status') as StatusFilter | null;
      this.statusFilter = this.clinical && FILTERS.some(f => f.key === status) ? status! : 'all';
      this.query = q.get('q') ?? '';
      if (q.get('add') === '1' && !this.drawerOpen) {
        this.openDrawer(null);
      }
    }));
    this.load();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    clearTimeout(this.noticeTimer);
    this.doc.body.classList.remove('drawer-open');
  }

  load(): void {
    this.errorMessage = null;
    this.care.load().subscribe({
      next: (s: CareSnapshot) => {
        this.rows = s.rows;
        this.today = s.today;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.errorMessage = 'Could not load patients.';
        console.error('Fetch patients error', error?.status);
      }
    });
  }

  retry(): void {
    this.loading = true;
    this.load();
  }

  /* ---------- filtering and sorting ---------- */

  get activeCount(): number {
    if (!this.clinical) {
      return 0;
    }
    return this.rows.filter(r => r.followUp?.status === 'ACTIVE').length;
  }

  get searched(): PatientRow[] {
    const q = normalizeText(this.query.trim());
    if (!q) {
      return this.rows;
    }
    return this.rows.filter(r => {
      const p = r.patient;
      return normalizeText(`${p.firstName} ${p.lastName}`).includes(q) || normalizeText(`${p.lastName} ${p.firstName}`).includes(q);
    });
  }

  count(key: StatusFilter): number {
    const f = FILTERS.find(x => x.key === key)!;
    return f.status ? this.searched.filter(r => r.status === f.status).length : this.searched.length;
  }

  get visible(): PatientRow[] {
    const f = FILTERS.find(x => x.key === this.statusFilter)!;
    const list = f.status ? this.searched.filter(r => r.status === f.status) : this.searched;
    return [...list].sort((a, b) => this.compare(a, b));
  }

  private compare(a: PatientRow, b: PatientRow): number {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const byName = this.byName(a, b);
    const nullsLast = (x: number | string | null, y: number | string | null): number | null => {
      if (x === null && y === null) {
        return 0;
      }
      if (x === null) {
        return 1;
      }
      if (y === null) {
        return -1;
      }
      return null;
    };
    const cmp = (x: number | string | null, y: number | string | null): number => {
      const n = nullsLast(x, y);
      if (n !== null) {
        return n; // nulls always last, whatever the direction
      }
      return (x! < y! ? -1 : x! > y! ? 1 : 0) * dir;
    };
    let r = 0;
    switch (this.sortKey) {
      case 'patient': return this.byName(a, b) * dir;
      case 'status': r = (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * dir; break;
      case 'followUp': r = cmp(a.day && a.followUp?.status === 'ACTIVE' ? a.day.day / a.day.total : null,
        b.day && b.followUp?.status === 'ACTIVE' ? b.day.day / b.day.total : null); break;
      case 'lastCheckIn': r = cmp(a.lastCheckInDate, b.lastCheckInDate); break;
      case 'pain': r = cmp(a.lastPain, b.lastPain); break;
      case 'alerts': r = ((a.openHigh - b.openHigh) || (a.unresolved - b.unresolved)) * dir; break;
      case 'next': r = cmp(a.nextAppointment?.scheduledAt ?? null, b.nextAppointment?.scheduledAt ?? null); break;
    }
    return r || byName;
  }

  private byName(a: PatientRow, b: PatientRow): number {
    return a.patient.lastName.localeCompare(b.patient.lastName) || a.patient.firstName.localeCompare(b.patient.firstName);
  }

  setStatus(key: StatusFilter): void {
    this.statusFilter = key;
    this.router.navigate([], { relativeTo: this.route, queryParams: { status: key === 'all' ? null : key }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  setQuery(q: string): void {
    this.query = q;
    this.router.navigate([], { relativeTo: this.route, queryParams: { q: q.trim() ? q : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  clearFilters(): void {
    this.statusFilter = 'all';
    this.query = '';
    this.router.navigate([], { relativeTo: this.route, queryParams: { status: null, q: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Choosing a key starts it in its natural direction: most open alerts first, everything else ascending. */
  sortBy(key: SortKey): void {
    this.sortKey = key;
    this.sortDir = key === 'alerts' ? 'desc' : 'asc';
  }

  toggleSortDir(): void {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
  }

  get sortLabel(): string {
    return SORT_OPTIONS.find(o => o.key === this.sortKey)!.label;
  }

  /** Accessible name of the direction button: it states the CURRENT order, which is what the list actually shows. */
  get sortDirLabel(): string {
    return `${this.sortLabel}: ${this.sortDir === 'asc' ? 'ascending' : 'descending'}. Switch to ${this.sortDir === 'asc' ? 'descending' : 'ascending'}`;
  }

  rowClick(r: PatientRow, e: Event): void {
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    this.router.navigate(['/patients', r.patient.id]);
  }

  private recentCache = new WeakMap<PatientRow, SeriesPoint[]>();

  /** Last 7 pain points (memoised so the chart input keeps the same reference between change detections). */
  recent(r: PatientRow): SeriesPoint[] {
    let v = this.recentCache.get(r);
    if (!v) {
      v = r.painSeries.slice(-7);
      this.recentCache.set(r, v);
    }
    return v;
  }

  atOrAbove(r: PatientRow): boolean {
    return r.lastPain !== null && r.painThreshold !== null && r.lastPain >= r.painThreshold;
  }

  /* ---------- add patient drawer ---------- */

  openDrawer(trigger: HTMLElement | null): void {
    this.trigger = trigger ?? (this.doc.activeElement as HTMLElement | null);
    this.drawerOpen = true;
    this.doc.body.classList.add('drawer-open');
    setTimeout(() => (this.doc.getElementById('new-firstName') as HTMLElement | null)?.focus());
  }

  closeDrawer(): void {
    if (!this.drawerOpen) {
      return;
    }
    this.drawerOpen = false;
    this.addError = null;
    this.doc.body.classList.remove('drawer-open');
    if (this.route.snapshot.queryParamMap.get('add')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { add: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    this.trigger?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.drawerOpen) {
      return;
    }
    if (e.key === 'Escape') {
      this.closeDrawer();
    } else if (e.key === 'Tab' && this.drawerEl) {
      const els = Array.from(this.drawerEl.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!els.length) {
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = this.doc.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  addPatient(): void {
    this.addError = null;
    this.saving = true;
    this.patientService.addPatient({ ...this.patient, dateOfBirth: this.patient.dateOfBirth || null }).subscribe({
      next: () => {
        this.saving = false;
        this.resetForm();
        this.closeDrawer();
        this.load();
        this.notice = 'Patient added.';
        clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => (this.notice = null), 4000);
      },
      error: error => {
        this.saving = false;
        this.addError = 'Error adding patient.';
        console.error('Add patient error', error?.status);
      }
    });
  }

  deletePatient(p: Patient): void {
    if (!window.confirm(`Delete ${p.firstName} ${p.lastName}?`)) {
      return;
    }
    this.actionError = null;
    this.patientService.deletePatient(p.id!).subscribe({
      next: () => this.load(),
      error: error => {
        this.actionError = error?.status === 409
          ? 'Patient has follow-up or appointment records and cannot be deleted.'
          : 'Error deleting patient.';
        console.error('Delete patient error', error?.status);
      }
    });
  }

  private resetForm(): void {
    this.patient = emptyPatient();
  }

  isFormValid(): boolean {
    return (
      this.patient.firstName.trim() !== '' &&
      this.patient.lastName.trim() !== '' &&
      this.patient.email.trim() !== '' &&
      this.patient.phone.trim() !== '' &&
      this.patient.address.city.trim() !== '' &&
      this.patient.address.state.trim() !== '' &&
      this.patient.address.zip.trim() !== ''
    );
  }
}
