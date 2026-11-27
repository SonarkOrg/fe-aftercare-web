import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { Permissions } from '../../../auth/permissions.service';
import { ArrivalService } from '../../../Services/Arrival.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { fmtClock } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { ArrivalRow, Arrivals, DeskState } from '../../../models/arrival.model';
import { businessToday } from '../../../shared/link.util';
import { ArrivalBoxComponent, BoxKey } from '../arrival-box/arrival-box.component';
import { maybeNam, matchesRow } from '../desk-search';
import { FD_IDLE_MS, IdleTimer } from '../fd-idle';
import { ToastState } from '../undo-toast/undo-toast.component';
import { extractNam } from '../../../shared/ramq.util';

/** Every how-often decision of the page in one place. */
export const POLL_MS = 20_000;
const VIEW_KEY = 'aftercare.appts.view';

/** Rows of the « Raccourcis » popover (spec 7.3). */
const KEY_ROWS = [
  { key: 'fd.keys.k.type', desc: 'fd.keys.d.type' },
  { key: 'fd.keys.k.arrows', desc: 'fd.keys.d.arrows' },
  { key: 'fd.keys.k.enter', desc: 'fd.keys.d.enter' },
  { key: 'fd.keys.k.shiftEnter', desc: 'fd.keys.d.shiftEnter' },
  { key: 'fd.keys.k.esc', desc: 'fd.keys.d.esc' },
  { key: 'fd.keys.k.undo', desc: 'fd.keys.d.undo' }
] as const;

interface Counts { expected: number; toCheck: number; arrived: number; walkIns: number; closed: number }

function byTime(a: ArrivalRow, b: ArrivalRow): number {
  return a.scheduledAt.localeCompare(b.scheduledAt) || a.appointmentId - b.appointmentId;
}

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.component.html'
})
export class ArrivalsComponent implements OnInit, OnDestroy {
  @ViewChild(ArrivalBoxComponent) box?: ArrivalBoxComponent;

  loading = true;
  loadError = false;
  /** The last poll failed: the previous list stays on screen. */
  stale = false;
  readOnly = false;
  dateParam: string | undefined;
  data: Arrivals | null = null;
  rows: ArrivalRow[] = [];
  updated = '';
  counts: Counts = { expected: 0, toCheck: 0, arrived: 0, walkIns: 0, closed: 0 };

  query = '';
  cardHint = false;
  expected: ArrivalRow[] = [];
  here: ArrivalRow[] = [];
  closed: ArrivalRow[] = [];
  closedOpen = false;
  activeId: number | null = null;
  /** The highlight was moved with the arrow keys: Enter may then act on an empty box (never by accident). */
  navigated = false;
  selectionText = '';
  live = '';

  expandedId: number | null = null;
  /** Appointments with a request in flight (the same row is never sent twice; different rows may overlap). */
  busy = new Set<number>();
  actionError: string | null = null;
  toast: ToastState | null = null;
  locked = false;
  keysOpen = false;
  keyRows = KEY_ROWS;

  private seq = 0;
  private toastTarget: number | null = null;
  private pending = 0;
  private listSub?: Subscription;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private idle = new IdleTimer(() => this.lock(), FD_IDLE_MS);

  constructor(
    private arrivals: ArrivalService, private i18n: I18nService, private errors: ApiErrorsService, private permissions: Permissions,
    private router: Router, private route: ActivatedRoute, private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    try {
      localStorage.setItem(VIEW_KEY, 'arrivals');
    } catch { /* storage may be blocked: the view just is not remembered */ }
    const d = this.route.snapshot.queryParamMap.get('date');
    this.dateParam = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
    this.load();
    this.pollHandle = setInterval(() => this.poll(), POLL_MS);
    this.idle.touch();
    setTimeout(() => this.box?.focus());
  }

  ngOnDestroy(): void {
    this.listSub?.unsubscribe();
    this.idle.stop();
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  // ---------- loading and polling ----------

  load(): void {
    this.listSub?.unsubscribe(); // the latest request wins: a slower older answer never overwrites a newer row
    this.pending++;
    this.listSub = this.arrivals.list(this.dateParam).pipe(finalize(() => this.pending--)).subscribe({
      next: d => {
        this.data = d;
        this.readOnly = !d.today;
        this.rows = d.rows;
        this.updated = fmtClock(d.serverTime.substring(11, 16), this.i18n.lang);
        this.loading = false;
        this.loadError = false;
        this.stale = false;
        this.recompute();
      },
      error: () => {
        this.loading = false;
        if (this.data) {
          this.stale = true; // keep the last list
        } else {
          this.loadError = true;
        }
      }
    });
  }

  retry(): void {
    this.loading = true;
    this.loadError = false;
    this.load();
    this.refocus();
  }

  /** Called every 20 s: skipped while hidden, masked, busy or while a panel is open. */
  poll(): void {
    if (document.visibilityState !== 'visible' || this.locked || this.pending > 0 || this.expandedId !== null || this.keysOpen) {
      return;
    }
    this.load();
  }

  // ---------- derived state ----------

  private recompute(): void {
    const today = businessToday();
    const q = this.query;
    const match = (r: ArrivalRow) => matchesRow(r.patient, q, today);
    const all = this.rows;
    this.expected = all.filter(r => (r.desk.state === 'GO' || r.desk.state === 'CHECK') && match(r)).sort(byTime);
    this.here = all.filter(r => r.desk.state === 'ARRIVED' && match(r))
      .sort((a, b) => (b.arrival?.arrivedAt ?? '').localeCompare(a.arrival?.arrivedAt ?? '') || byTime(a, b));
    this.closed = all.filter(r => r.desk.state === 'CLOSED' && match(r)).sort(byTime);
    const n = (s: DeskState) => all.filter(r => r.desk.state === s).length;
    this.counts = { expected: n('GO') + n('CHECK'), toCheck: n('CHECK'), arrived: n('ARRIVED'), walkIns: all.filter(r => r.walkIn).length, closed: n('CLOSED') };
    const nav = this.navigable;
    if (!nav.some(r => r.appointmentId === this.activeId)) {
      if (this.activeId !== null) {
        // the highlighted row left the list (poll, reload, other desk): the fallback row was not chosen by anyone,
        // so Enter must not arrive it until the secretary types or arrows again
        this.navigated = false;
      }
      this.activeId = nav.length ? nav[0].appointmentId : null;
    }
    this.selectionText = this.locked ? '' : this.describeActive();
  }

  get navigable(): ArrivalRow[] {
    return [...this.expected, ...this.here, ...(this.closedOpen ? this.closed : [])];
  }

  get activeRow(): ArrivalRow | null {
    return this.navigable.find(r => r.appointmentId === this.activeId) ?? null;
  }

  get visibleCount(): number {
    return this.expected.length + this.here.length + this.closed.length;
  }

  get filtering(): boolean {
    return this.query.trim().length > 0;
  }

  /** The typed text is echoed or linked only when it cannot be a health number. */
  get safeQuery(): boolean {
    return !maybeNam(this.query);
  }

  private describeActive(): string {
    const r = this.activeRow;
    if (!r) {
      return '';
    }
    const time = fmtClock(r.scheduledAt.substring(11, 16), this.i18n.lang);
    return this.i18n.t('fd.box.selection', { name: `${r.patient.firstName} ${r.patient.lastName}`, time, status: this.i18n.t(this.chipKey(r.desk.state)) });
  }

  private chipKey(s: DeskState): 'chip.desk.GO' | 'chip.desk.CHECK' | 'chip.desk.ARRIVED' | 'chip.desk.CLOSED' {
    return s === 'GO' ? 'chip.desk.GO' : s === 'CHECK' ? 'chip.desk.CHECK' : s === 'ARRIVED' ? 'chip.desk.ARRIVED' : 'chip.desk.CLOSED';
  }

  trackRow = (_: number, r: ArrivalRow): number => r.appointmentId;

  // ---------- the box ----------

  onQuery(text: string): void {
    if (extractNam(text) !== null) {
      this.clearBox(); // a card number is recognised in memory and dropped at once; it is never stored (spec 3.1.8)
      this.cardHint = true;
      return;
    }
    this.query = text;
    this.cardHint = false;
    this.navigated = false;
    this.activeId = null;
    this.recompute();
  }

  onKey(k: BoxKey): void {
    switch (k) {
      case 'up': this.move(-1); break;
      case 'down': this.move(1); break;
      case 'enter': this.enter(); break;
      default: this.openFile(); break;
    }
  }

  private move(delta: number): void {
    const nav = this.navigable;
    if (!nav.length) {
      return;
    }
    const i = nav.findIndex(r => r.appointmentId === this.activeId);
    const next = nav[Math.min(nav.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta))];
    this.activeId = next.appointmentId;
    this.navigated = true;
    this.selectionText = this.describeActive();
    this.cdr.detectChanges();
    document.querySelector(`.fd-row[data-appt="${next.appointmentId}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }

  private enter(): void {
    if (maybeNam(this.query)) {
      // a card number, valid or not (a typo such as month 13), never stays in the box or reaches a link
      this.clearBox();
      this.cardHint = true;
      return;
    }
    const row = this.activeRow;
    if (!row || (!this.filtering && !this.navigated)) {
      return;
    }
    if (row.desk.state === 'ARRIVED') {
      this.live = this.i18n.t('fd.box.alreadyHere');
      return;
    }
    if (row.desk.state === 'CLOSED' || this.readOnly || !this.permissions.can('APPOINTMENT_WRITE')) {
      return;
    }
    this.arrive(row);
  }

  private openFile(): void {
    const row = this.activeRow;
    if (row) {
      void this.router.navigate(['/patients', row.patient.id]);
    }
  }

  onUndoKey(e: KeyboardEvent): void {
    if (this.query === '' && this.toast?.undoable) {
      e.preventDefault();
      this.undoLast();
    } // otherwise the browser's ordinary text undo runs
  }

  private clearBox(): void {
    this.query = '';
    this.box?.clear();
    this.navigated = false;
    this.activeId = null;
    this.recompute();
  }

  /** The only place that gives the focus back; the box is the only element this module ever focuses. */
  private refocus(): void {
    this.box?.focus();
  }

  // ---------- actions ----------

  arrive(row: ArrivalRow): void {
    if (this.busy.has(row.appointmentId)) {
      return;
    }
    this.busy.add(row.appointmentId);
    this.pending++;
    this.actionError = null;
    const queryAtStart = this.query;
    this.arrivals.arrive(row.appointmentId).pipe(finalize(() => { this.pending--; this.busy.delete(row.appointmentId); })).subscribe({
      next: r => {
        this.replace(r);
        const name = `${row.patient.firstName} ${row.patient.lastName.charAt(0)}.`;
        this.live = this.i18n.t('appts.live.arrived', { name: `${row.patient.firstName} ${row.patient.lastName}` });
        this.toast = { id: ++this.seq, message: this.i18n.t('fd.toast.arrived', { name }), undoable: true };
        this.toastTarget = row.appointmentId;
        this.cardHint = false;
        if (this.query === queryAtStart) {
          this.clearBox(); // not when the user already started typing the next name
        }
        this.refocus();
        this.load();
      },
      error: err => this.fail(err)
    });
  }

  undoRow(row: ArrivalRow): void {
    if (this.busy.has(row.appointmentId)) {
      return;
    }
    this.busy.add(row.appointmentId);
    this.pending++;
    this.actionError = null;
    this.arrivals.undo(row.appointmentId).pipe(finalize(() => { this.pending--; this.busy.delete(row.appointmentId); })).subscribe({
      next: r => {
        this.replace(r);
        this.live = this.i18n.t('appts.live.arrivalUndone', { name: `${row.patient.firstName} ${row.patient.lastName}` });
        this.toast = { id: ++this.seq, message: this.i18n.t('fd.toast.undone'), undoable: false };
        this.toastTarget = null;
        this.refocus();
        this.load();
      },
      error: err => this.fail(err)
    });
  }

  undoLast(): void {
    const row = this.rows.find(r => r.appointmentId === this.toastTarget);
    if (row) {
      this.undoRow(row);
    }
  }

  onToastDone(): void {
    this.toast = null;
    this.toastTarget = null;
  }

  private fail(err: { status?: number }): void {
    this.actionError = this.errors.text(err, 'appts.error.arrive');
    if (err?.status === 409 || err?.status === 404) { // closed, wrong day or deleted by another desk: show the truth
      this.load();
    }
    this.refocus(); // the box keeps its text: Enter retries (arrival is idempotent)
  }

  private replace(r: ArrivalRow): void {
    this.rows = this.rows.map(x => (x.appointmentId === r.appointmentId ? r : x));
    this.recompute();
  }

  toggle(row: ArrivalRow): void {
    const closing = this.expandedId === row.appointmentId;
    this.expandedId = closing ? null : row.appointmentId;
    if (closing) {
      this.refocus();
    }
  }

  onConsent(e: { row: ArrivalRow; value: 'GRANTED' | 'WITHDRAWN' }): void {
    const row = this.rows.find(r => r.appointmentId === e.row.appointmentId);
    if (row) {
      this.replace({ ...row, patient: { ...row.patient, contactConsent: e.value }, desk: { ...row.desk, notices: row.desk.notices.filter(n => n !== 'CONSENT_UNKNOWN') } });
    }
    this.refocus();
    this.load();
  }

  onClosedToggle(open: boolean): void {
    this.closedOpen = open;
    this.recompute();
  }

  toggleKeys(): void {
    this.keysOpen = !this.keysOpen;
    if (!this.keysOpen) {
      this.refocus();
    }
  }

  // ---------- keyboard and idle ----------

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(e: KeyboardEvent): void {
    this.activity();
    if (this.locked) {
      return;
    }
    if (e.key === 'Escape') {
      if ((e.target as HTMLElement | null)?.closest?.('.send-link__menu')) {
        return; // the send-link menu closes itself
      }
      this.escape();
      return;
    }
    const typing = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (typing && (document.activeElement === document.body || document.activeElement === null)) {
      this.refocus();
    }
  }

  private escape(): void {
    if (this.keysOpen) {
      this.keysOpen = false;
      this.refocus();
    } else if (this.expandedId !== null) {
      this.expandedId = null;
      this.refocus();
    } else {
      this.cardHint = false;
      this.clearBox();
    }
  }

  @HostListener('document:pointerdown')
  @HostListener('document:wheel')
  onPointer(): void {
    this.activity();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.keysOpen && !(e.target as HTMLElement | null)?.closest?.('.fd-keys-wrap')) {
      this.keysOpen = false;
    }
  }

  private activity(): void {
    if (this.locked) {
      this.locked = false;
      this.load(); // exactly one poll after the mask is lifted
    }
    this.idle.touch();
  }

  private lock(): void {
    this.locked = true;
    this.expandedId = null; // a link code or a birth date must not stay readable behind the mask
    this.keysOpen = false;
    this.toast = null;
    this.toastTarget = null;
    this.cardHint = false;
    this.clearBox();
    this.selectionText = ''; // no name may stay in the live regions behind the mask
    this.live = '';
    this.listSub?.unsubscribe(); // no request while masked, not even one that was already running
  }
}
