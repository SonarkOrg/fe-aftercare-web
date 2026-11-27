import { DOCUMENT } from '@angular/common';
import { Component, ComponentRef, Inject, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CareDataService } from '../../Services/CareData.service';
import { PatientService } from '../../Services/Patient.service';
import { Permissions } from '../../auth/permissions.service';
import { ApiErrorsService } from '../../i18n/api-errors';
import { collate, fmtClock, fmtDate } from '../../i18n/format';
import { I18nService } from '../../i18n/i18n.service';
import { TKey } from '../../i18n/i18n.types';
import { Patient } from '../../models/patient.model';
import { CareSnapshot, PatientRow, PatientStatus, SeriesPoint } from '../../shared/care.model';
import { addDays, businessToday, relativeDay } from '../../shared/link.util';
import { STATUS_RANK } from '../../shared/patient-status';
import { GLYPH, patientStatusChip } from '../../shared/status';

export type StatusFilter = 'all' | 'critical' | 'attention' | 'stable' | 'inactive';
export type SortKey = 'patient' | 'status' | 'followUp' | 'lastCheckIn' | 'pain' | 'alerts' | 'next';

export const SORT_OPTIONS: { key: SortKey; label: TKey }[] = [
  { key: 'status', label: 'patients.sort.status' },
  { key: 'patient', label: 'patients.sort.name' },
  { key: 'lastCheckIn', label: 'patients.col.lastCheckIn' },
  { key: 'pain', label: 'patients.col.pain' },
  { key: 'alerts', label: 'patients.sort.alerts' },
  { key: 'next', label: 'patients.col.next' }
];

const FILTERS: { key: StatusFilter; label: TKey; glyph: string; status?: PatientStatus }[] = [
  { key: 'all', label: 'patients.filter.all', glyph: '' },
  { key: 'critical', label: 'enum.patientStatus.CRITICAL', glyph: GLYPH.critical, status: 'CRITICAL' },
  { key: 'attention', label: 'enum.patientStatus.ATTENTION', glyph: GLYPH.warning, status: 'ATTENTION' },
  { key: 'stable', label: 'enum.patientStatus.STABLE', glyph: GLYPH.good, status: 'STABLE' },
  { key: 'inactive', label: 'enum.patientStatus.INACTIVE', glyph: GLYPH.neutral, status: 'INACTIVE' }
];

export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Text that holds a complete health insurance number (4 letters then 8 digits, whatever separators in between: spaces, dots,
 * hyphens, pairs of digits). It is never written to the URL and never kept in the page. A looser twin of `looksLikeNam`
 * (shared/ramq.util), kept local so the eager Patients chunk does not pull that module in.
 */
function isCardText(text: string): boolean {
  return /[a-z]{4}\d{8}/i.test(text.replace(/[^a-z0-9]/gi, ''));
}

/**
 * Text that could be the START of a health number (4 letters then a digit, separators ignored): it stays in the box and
 * filters, but is never written to `?q=` (a keyboard-wedge scan types the number one character at a time, spec 3.1.8).
 */
function mayBeCardText(text: string): boolean {
  return /[a-z]{4}\d/i.test(text.replace(/[^a-z0-9]/gi, ''));
}

@Component({
  selector: 'app-patients',
  templateUrl: './patients.component.html'
})
export class PatientsComponent implements OnInit, OnDestroy {
  rows: PatientRow[] = [];
  today = '';
  loading = true;
  errorMessage: string | null = null;
  actionError: string | null = null;
  notice: string | null = null;
  drawerOpen = false;
  /** The search box held a health card number: it was emptied and the hint is shown. */
  cardHint = false;
  /** "Flagged duplicates" view: the pairs of GET /patients/duplicate-flags instead of the list. */
  duplicatesView = false;

  /** Status, follow-up and alert data exist only with CLINICAL_READ (the server sends them as null otherwise). */
  clinical = false;
  filters = FILTERS;
  sortOptions = SORT_OPTIONS;
  statusFilter: StatusFilter = 'all';
  query = '';
  sortKey: SortKey = 'status';
  sortDir: 'asc' | 'desc' = 'asc';

  relativeDay = relativeDay;
  chipOf = patientStatusChip;

  @ViewChild('drawerHost', { read: ViewContainerRef, static: true }) drawerHost!: ViewContainerRef;
  private drawerRef?: ComponentRef<unknown>;
  @ViewChild('dupHost', { read: ViewContainerRef, static: true }) dupHost!: ViewContainerRef;
  private dupRef?: ComponentRef<unknown>;
  private trigger: HTMLElement | null = null;
  private sub = new Subscription();
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private care: CareDataService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    public permissions: Permissions,
    public i18n: I18nService,
    private errors: ApiErrorsService
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
      const raw = q.get('q') ?? '';
      if (mayBeCardText(raw)) {
        // a number (or its start) typed or pasted into the address bar: drop it from the URL at once and keep it out of the page
        this.query = '';
        this.cardHint = isCardText(raw);
        this.router.navigate([], { relativeTo: this.route, queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
      } else {
        this.query = raw;
      }
      this.setDuplicatesView(q.get('duplicates') === '1' && this.permissions.can('PATIENT_READ'));
      if (q.get('add') === '1' && !this.drawerOpen) {
        this.openDrawer(null);
      }
    }));
    this.load();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.dupRef?.destroy();
    this.drawerRef?.destroy();
    clearTimeout(this.noticeTimer);
    clearTimeout(this.urlTimer);
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
        this.errorMessage = this.i18n.t('patients.error.load');
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
    return collate(a.patient.lastName, b.patient.lastName) || collate(a.patient.firstName, b.patient.firstName);
  }

  setStatus(key: StatusFilter): void {
    this.statusFilter = key;
    this.router.navigate([], { relativeTo: this.route, queryParams: { status: key === 'all' ? null : key }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Input handler of the search box: a health card number empties the box, the rest filters by name. */
  onSearchInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    this.setQuery(el.value);
    if (this.cardHint) {
      el.value = '';
    }
  }

  setQuery(q: string): void {
    if (isCardText(q)) {
      this.query = '';
      this.cardHint = true;
      this.router.navigate([], { relativeTo: this.route, queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
      return;
    }
    this.cardHint = false;
    this.query = q;
    if (mayBeCardText(q)) {
      // possibly a number being scanned or typed: filter, but leave the URL as it was (navigating would also re-read ?q=
      // into the box and empty it mid-scan, sending the remaining digits to the URL)
      return;
    }
    // debounced: a keyboard-wedge scan types its letters before its digits, and its letters must not reach the URL either
    clearTimeout(this.urlTimer);
    this.urlTimer = setTimeout(() => {
      if (this.query !== q || mayBeCardText(q)) {
        return;
      }
      this.router.navigate([], { relativeTo: this.route, queryParams: { q: q.trim() ? q : null }, queryParamsHandling: 'merge', replaceUrl: true });
    }, PatientsComponent.URL_DEBOUNCE_MS);
  }

  private urlTimer: ReturnType<typeof setTimeout> | undefined;
  static readonly URL_DEBOUNCE_MS = 400;

  /* ---------- add patient drawer (a standalone component, created on first use) ---------- */

  openDrawer(trigger: HTMLElement | null): void {
    this.trigger = trigger ?? (this.doc.activeElement as HTMLElement | null);
    this.drawerOpen = true;
    this.doc.body.classList.add('drawer-open');
    import('./add-patient-drawer/add-patient-drawer.component').then(m => {
      if (!this.drawerOpen || this.drawerRef) {
        return;
      }
      const ref = this.drawerHost.createComponent(m.AddPatientDrawerComponent);
      ref.instance.closed.subscribe(() => this.closeDrawer());
      ref.instance.created.subscribe(r => this.onCreated(r.consentSaved));
      ref.instance.useExisting.subscribe(id => {
        this.closeDrawer();
        this.router.navigate(['/patients', id]);
      });
      this.drawerRef = ref;
      ref.changeDetectorRef.detectChanges();
    });
  }

  closeDrawer(): void {
    if (!this.drawerOpen) {
      return;
    }
    this.drawerOpen = false;
    this.drawerRef?.destroy();
    this.drawerRef = undefined;
    this.doc.body.classList.remove('drawer-open');
    if (this.route.snapshot.queryParamMap.get('add')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { add: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    this.trigger?.focus();
  }

  private onCreated(consentSaved: boolean): void {
    this.actionError = null; // a failed delete from before is no longer relevant
    this.closeDrawer();
    this.load();
    this.notice = this.i18n.t(consentSaved ? 'patients.added' : 'patients.error.consent');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = null), consentSaved ? 4000 : 8000);
  }

  /* ---------- flagged duplicates ---------- */

  toggleDuplicates(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { duplicates: this.duplicatesView ? null : 1 }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** The pairs view is its own standalone component, fetched only when the filter is first used (the page is in the initial bundle). */
  private setDuplicatesView(on: boolean): void {
    if (on === this.duplicatesView) {
      return;
    }
    this.duplicatesView = on;
    this.dupRef?.destroy();
    this.dupRef = undefined;
    if (on) {
      import('./duplicate-pairs/duplicate-pairs.component').then(m => {
        if (this.duplicatesView && !this.dupRef) {
          this.dupRef = this.dupHost.createComponent(m.DuplicatePairsComponent);
          this.dupRef.changeDetectorRef.detectChanges();
        }
      });
    }
  }

  clearFilters(): void {
    this.statusFilter = 'all';
    this.query = '';
    this.cardHint = false;
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
    return this.i18n.t(SORT_OPTIONS.find(o => o.key === this.sortKey)!.label);
  }

  reasonsText(r: PatientRow): string {
    return r.reasons.map(m => this.i18n.t(m)).join(' · ');
  }

  nextDate(r: PatientRow): string {
    return fmtDate(r.nextAppointment!.scheduledAt.substring(0, 10), 'dayShort', this.i18n.lang);
  }

  nextTime(r: PatientRow): string {
    return fmtClock(r.nextAppointment!.scheduledAt.substring(11, 16), this.i18n.lang);
  }

  sortDirText(): string {
    return this.i18n.t(this.sortDir === 'asc' ? 'patients.sort.ascending' : 'patients.sort.descending');
  }

  /** Accessible name of the direction button: it states the CURRENT order, which is what the list actually shows. */
  get sortDirLabel(): string {
    return this.i18n.t(this.sortDir === 'asc' ? 'patients.sort.dirAsc' : 'patients.sort.dirDesc', { sort: this.sortLabel });
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

  deletePatient(p: Patient): void {
    if (!window.confirm(this.i18n.t('patients.confirmDelete', { name: `${p.firstName} ${p.lastName}` }))) {
      return;
    }
    this.actionError = null;
    this.patientService.deletePatient(p.id!).subscribe({
      next: () => this.load(),
      error: error => {
        this.actionError = this.errors.text(error, 'patients.error.delete');
        console.error('Delete patient error', error?.status);
      }
    });
  }
}
