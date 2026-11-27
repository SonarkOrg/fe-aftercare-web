import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, catchError, finalize, forkJoin, map, of } from 'rxjs';
import { Permissions } from '../../../auth/permissions.service';
import { ArrivalService } from '../../../Services/Arrival.service';
import { PatientDeskService } from '../../../Services/PatientDesk.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { fmtClock, fmtDate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { apiErrorOf } from '../../../models/api-error.model';
import {
  ArrivalRow, Arrivals, CardStatus, CardWarning, DeskPatient, DeskState, HealthCardRequest, PatientMatch, PatientSearchRequest,
  PatientSearchResult, QuickPatientResponse, SharedCardReason
} from '../../../models/arrival.model';
import { businessToday } from '../../../shared/link.util';
import { RowMenuItem } from '../../../shared/row-menu/row-menu.component';
import { ChipSpec, cardChip, reasonChip } from '../../../shared/status';
import { ArrivalBoxComponent, BoxKey } from '../arrival-box/arrival-box.component';
import { CardBannerState } from '../card-banner/card-banner.component';
import { maybeNam, matchesRow, nameParts, parseBirthDate } from '../desk-search';
import { FD_IDLE_MS, IdleTimer } from '../fd-idle';
import { QuickPrefill, RecentPatient } from '../quick-patient/quick-patient.component';
import { DeskCardBus } from '../scan-guard.directive';
import { ToastState, TOAST_MS } from '../undo-toast/undo-toast.component';
import { WalkInChoice, readWalkInChoice, WALK_IN_TYPES } from '../walk-in/walk-in.component';
import { cardExpiryLabel, extractNam, parseCardExpiry } from '../../../shared/ramq.util';
import { normalizeText } from '../../patients/patients.component';

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

/** A pending card number lives in memory for this long (spec 11.5, acceptance: null after 2 minutes). */
export const CARD_TTL_MS = 2 * 60 * 1000;
/** A toast that asks something (card expiry, family arrivals) stays longer than a plain one. */
export const ASK_TOAST_MS = 10_000;

type LastAction = { kind: 'arrival'; ids: number[]; cardPatientId: number | null } | { kind: 'walkIn'; id: number };
interface ArriveOpts { cardAttached?: boolean; cardStatus?: CardStatus }
type SearchKind = 'text' | 'card' | 'created' | null;
type CardKind = 'multi' | 'candidates' | 'none' | null;

interface Counts { expected: number; toCheck: number; arrived: number; walkIns: number; closed: number }

function byTime(a: ArrivalRow, b: ArrivalRow): number {
  return a.scheduledAt.localeCompare(b.scheduledAt) || a.appointmentId - b.appointmentId;
}

@Component({
  selector: 'app-arrivals',
  templateUrl: './arrivals.component.html',
  providers: [DeskCardBus]
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
  /** A typed text that looks like a card number but is not a valid one (a typo, month 13): said once, never echoed. */
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

  // ----- 1B: card, search, walk-in, drawer -----
  /** The card number just read, in memory only (never stored, logged, shown or put in a URL); gone after 2 minutes. */
  pendingCard: { nam: string; at: number } | null = null;
  /** Read, search not sent yet: the next Enter sends it. */
  cardQueued = false;
  noCardRole = false;
  searchKind: SearchKind = null;
  cardKind: CardKind = null;
  searching = false;
  attaching = false;
  cardBanner: CardBannerState | null = null;
  cardWarnings: CardWarning[] = [];
  /** The patient whose file the card matched (by number): arrival then also records « carte vue ». */
  cardMatchPatientId: number | null = null;
  /** Everything the server found, and the part of it that is shown (card choices narrow with the typed letters). */
  found: PatientMatch[] = [];
  results: PatientMatch[] = [];
  menus = new Map<number, RowMenuItem[]>();
  /** A result (or the new patient item) is highlighted instead of a row: `m:<patientId>` or `new`. */
  activeOther: string | null = null;
  /** The text for which Enter last announced « Déjà sur place » (a second Enter then searches every file). */
  private hereEnterFor: string | null = null;
  panel: PatientMatch | null = null;
  rateText: string | null = null;
  drawerOpen = false;
  prefill: QuickPrefill = { firstName: '', lastName: '', dateOfBirth: '', phone: '' };
  recent: RecentPatient | null = null;
  walkInFor: DeskPatient | null = null;
  walkInChoice: WalkInChoice = { type: 'GENERAL_CONSULT', specialty: 'ORTHOPEDIC_SURGERY' };
  walkBusy = false;
  dupChip: ChipSpec = reasonChip('POSSIBLE_DUPLICATE')!;
  /** Rows a search result points at stay listed even when the box text does not match them. */
  private forced = new Set<number>();
  private mismatch: { row: ArrivalRow | null } | null = null;
  private inUseTarget: { patient: DeskPatient; row: ArrivalRow | null } | null = null;
  private cardTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSub?: Subscription;
  private lastAction: LastAction | null = null;
  private toastBase = '';
  private toastUndoable = false;
  private expiryPrompt: { patientId: number; name: string } | null = null;
  private expiryEcho: string | null = null;

  /** The box text is an expiry answer Enter will save: the "no appointment for …" card must not contradict it. */
  get expiryAnswerPending(): boolean {
    return this.expiryEcho !== null;
  }
  private familyPrompt: { ids: number[]; names: string } | null = null;

  private seq = 0;
  private pending = 0;
  private listSub?: Subscription;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private idle = new IdleTimer(() => this.lock(), FD_IDLE_MS);

  private busSub?: Subscription;

  constructor(
    private arrivals: ArrivalService, private i18n: I18nService, private errors: ApiErrorsService, private permissions: Permissions,
    private router: Router, private route: ActivatedRoute, private cdr: ChangeDetectorRef, private desk: PatientDeskService, bus: DeskCardBus
  ) {
    this.busSub = bus.scanned.subscribe(nam => this.onScanned(nam));
  }

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
    this.searchSub?.unsubscribe();
    this.busSub?.unsubscribe();
    this.dropPending();
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

  /** In the card flow with several files to choose from, nothing is highlighted until the typed letters leave exactly one. */
  private get holdHighlight(): boolean {
    return this.cardKind === 'multi' || this.cardKind === 'candidates';
  }

  private recompute(): void {
    const today = businessToday();
    const q = this.query;
    const match = (r: ArrivalRow) => matchesRow(r.patient, q, today) || this.forced.has(r.appointmentId);
    const all = this.rows;
    this.expected = all.filter(r => (r.desk.state === 'GO' || r.desk.state === 'CHECK') && match(r)).sort(byTime);
    this.here = all.filter(r => r.desk.state === 'ARRIVED' && match(r))
      .sort((a, b) => (b.arrival?.arrivedAt ?? '').localeCompare(a.arrival?.arrivedAt ?? '') || byTime(a, b));
    this.closed = all.filter(r => r.desk.state === 'CLOSED' && match(r)).sort(byTime);
    const n = (s: DeskState) => all.filter(r => r.desk.state === s).length;
    this.counts = { expected: n('GO') + n('CHECK'), toCheck: n('CHECK'), arrived: n('ARRIVED'), walkIns: all.filter(r => r.walkIn).length, closed: n('CLOSED') };
    this.recomputeResults();
    const nav = this.navigable;
    if (this.activeOther !== null) {
      this.activeId = null;
    } else if (this.holdHighlight && !this.navigated) {
      this.activeId = null;
    } else if (!nav.some(r => r.appointmentId === this.activeId)) {
      if (this.activeId !== null) {
        // the highlighted row left the list (poll, reload, other desk): the fallback row was not chosen by anyone,
        // so Enter must not arrive it until the secretary types or arrows again
        this.navigated = false;
      }
      this.activeId = nav.length && !this.holdHighlight ? nav[0].appointmentId : null;
    }
    this.selectionText = this.locked ? '' : this.describeActive();
  }

  /** The shown results: all of them, or (card choices) those whose last name starts with the typed letters. */
  private recomputeResults(): void {
    let shown = this.found;
    if (this.holdHighlight && this.letters(this.query).length > 0) {
      const narrowed = this.found.filter(m => this.lastNameStarts(m.patient, this.query));
      shown = narrowed.length ? narrowed : this.found;
    }
    this.results = shown;
    this.menus = new Map(shown.map(m => [m.patient.id, this.menuFor(m, shown)]));
    if (this.holdHighlight) {
      const pick = this.pick();
      this.activeOther = pick ? `m:${pick.patient.id}` : null;
    } else if (this.activeOther?.startsWith('m:') && !shown.some(m => `m:${m.patient.id}` === this.activeOther)) {
      this.activeOther = this.searchKind ? 'new' : null;
    }
  }

  private letters(text: string): string {
    return normalizeText(text ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  private lastNameStarts(p: DeskPatient, text: string): boolean {
    const tokens = normalizeText(text ?? '').toUpperCase().split(/[\s,\-'’]+/).filter(Boolean);
    const parts = nameParts(p.lastName);
    return tokens.length > 0 && tokens.every(t => parts.some(part => part.startsWith(t)));
  }

  /** The one choice the typed letters point at: at least 2 letters and exactly one file (never a default). */
  private pick(): PatientMatch | null {
    if (this.letters(this.query).length < 2) {
      return null;
    }
    const hits = this.found.filter(m => this.lastNameStarts(m.patient, this.query));
    return hits.length === 1 ? hits[0] : null;
  }

  private menuFor(m: PatientMatch, all: PatientMatch[]): RowMenuItem[] {
    if (all.length < 2 || !this.permissions.can('PATIENT_WRITE') || this.readOnly) {
      return [];
    }
    return all.filter(o => o.patient.id !== m.patient.id).map(o => ({
      key: `dup:${o.patient.id}`,
      label: this.i18n.t('fd.result.duplicateOf', {
        name: `${o.patient.firstName} ${o.patient.lastName}`,
        date: o.patient.dateOfBirth ? fmtDate(o.patient.dateOfBirth, 'date', this.i18n.lang) : this.i18n.t('fd.result.dobUnknown')
      })
    }));
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

  get showResults(): boolean {
    return this.searchKind !== null || this.searching;
  }

  get clinical(): boolean {
    return this.permissions.can('CLINICAL_WRITE');
  }

  get canCreatePatient(): boolean {
    return !this.readOnly && this.permissions.can('PATIENT_WRITE');
  }

  /** « Carte lue ✓ » shows in the box's place while a read card waits for its search. */
  get boxPlaceholder(): string {
    if (this.walkInFor) {
      return this.i18n.t('fd.box.placeholder.walkIn');
    }
    return this.cardReadShown ? this.i18n.t('fd.card.read') : '';
  }

  /** From the read until the card search answers (it was hidden as soon as Enter started the search). */
  get cardReadShown(): boolean {
    return !!this.pendingCard && (this.cardQueued || (this.searching && this.searchKind === 'card'));
  }

  private describeActive(): string {
    if (this.activeOther) {
      const m = this.results.find(x => `m:${x.patient.id}` === this.activeOther);
      return m ? `${m.patient.firstName} ${m.patient.lastName}` : this.i18n.t('fd.search.new');
    }
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
  trackMatch = (_: number, m: PatientMatch): number => m.patient.id;

  /** The first open appointment of a result that is on today's list. */
  appointmentOf(m: PatientMatch): { time: string } | null {
    const a = m.todayAppointments.find(x => !x.arrived);
    return a ? { time: fmtClock(a.scheduledAt.substring(11, 16), this.i18n.lang) } : null;
  }

  /** A result whose only appointments today are already arrived (« Déjà sur place », never « Aucun rendez-vous »). */
  alreadyHere(m: PatientMatch): boolean {
    return m.todayAppointments.length > 0 && m.todayAppointments.every(x => x.arrived);
  }

  // ---------- the box ----------

  /**
   * After a card number is read, the rest of a longer scanner payload (names, birth date: unverified 2D content) is
   * swallowed until its Enter or a 250 ms pause, so it never reaches the box, a search or the screen (spec 3.1.11).
   */
  private swallowAfterCard = false;
  private lastInputAt = 0;
  static readonly SCAN_PAUSE_MS = 250;

  onQuery(text: string): void {
    const now = Date.now();
    const gap = now - this.lastInputAt;
    this.lastInputAt = now;
    if (this.swallowAfterCard) {
      // a scanner types one character at a time into the emptied box; a pause or a whole text at once (a paste) is a person
      if (gap < ArrivalsComponent.SCAN_PAUSE_MS && text.length <= 1) {
        this.query = '';
        this.box?.clear(); // the scanner is still typing: discard in memory
        return;
      }
      this.swallowAfterCard = false; // a pause: a person is typing now
    }
    const nam = extractNam(text);
    if (nam !== null) {
      this.readCard(nam); // a card number is recognised in memory and dropped from the box at once (spec 3.1.8)
      return;
    }
    this.query = text;
    this.cardHint = false;
    this.noCardRole = false;
    this.rateText = null;
    this.navigated = false;
    this.activeId = null;
    if (this.searchKind === 'text' || this.searchKind === 'created') {
      this.resetResults(); // the results belong to the text that was searched
    }
    if (this.cardKind === 'none') {
      // typed letters filter today's rows (Enter attaches the card to a row without one); an empty box offers « Nouveau patient » again
      if (text.trim() === '') {
        this.highlightNewForCard();
      } else if (this.activeOther === 'new') {
        this.activeOther = null;
      }
    }
    this.updateExpiryEcho();
    this.recompute();
  }

  onKey(k: BoxKey): void {
    switch (k) {
      case 'up': this.move(-1); break;
      case 'down': this.move(1); break;
      case 'enter': this.enter(); break;
      case 'tab': this.cycleType(); break;
      default: this.openFile(); break;
    }
  }

  private order(): string[] {
    const rows = this.navigable.map(r => `r:${r.appointmentId}`);
    const others = this.searchKind ? [...this.results.map(m => `m:${m.patient.id}`), ...(this.canCreatePatient ? ['new'] : [])] : [];
    return [...rows, ...others];
  }

  private move(delta: number): void {
    const order = this.order();
    if (!order.length) {
      return;
    }
    const cur = this.activeOther ?? (this.activeId !== null ? `r:${this.activeId}` : null);
    const i = cur === null ? -1 : order.indexOf(cur);
    const next = order[Math.min(order.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta))];
    if (next.startsWith('r:')) {
      this.activeOther = null;
      this.activeId = Number(next.slice(2));
    } else {
      this.activeOther = next;
      this.activeId = null;
    }
    this.navigated = true;
    this.selectionText = this.describeActive();
    this.cdr.detectChanges();
    const sel = next.startsWith('r:') ? `.fd-row[data-appt="${next.slice(2)}"]` : next === 'new' ? '.fd-found__new' : `.fd-found__item[data-patient="${next.slice(2)}"]`;
    document.querySelector(sel)?.scrollIntoView?.({ block: 'nearest' });
  }

  private enter(): void {
    if (this.swallowAfterCard) {
      // the Enter suffix of the scanner that sent the card: whatever followed the number was discarded
      this.swallowAfterCard = false;
      if (this.query !== '') {
        this.clearBox();
      }
    }
    const empty = this.query.trim() === '';
    if (this.cardQueued && empty) {
      this.runCardSearch();
      return;
    }
    if (maybeNam(this.query)) {
      // a card number, valid or not (a typo such as month 13), never stays in the box or reaches a link
      this.clearBox();
      this.cardHint = true;
      return;
    }
    if (empty && this.walkInFor) {
      this.createWalkIn();
      return;
    }
    if (!empty && this.expiryPrompt) {
      const ym = parseCardExpiry(this.query, businessToday());
      if (ym) {
        this.saveExpiryFromBox(ym);
        return;
      }
    }
    // an empty-box Enter that nobody steered (no arrow, no result highlighted): an open panel, then the family prompt
    // (§11.5 precedence); a row chosen with the arrows wins over both (review p1b)
    const unsteered = !this.navigated && this.activeOther === null;
    if (empty && unsteered && this.panel) {
      return;
    }
    if (empty && unsteered && this.familyPrompt) {
      this.arriveFamily();
      return;
    }
    if (this.cardBanner?.kind === 'mismatch') {
      const row = this.mismatch?.row;
      if (row && (row.desk.state === 'GO' || row.desk.state === 'CHECK') && !this.readOnly && this.permissions.can('APPOINTMENT_WRITE')) {
        this.noteWithoutCard();
      }
      return;
    }
    if (this.holdHighlight) {
      const pick = this.pick();
      if (pick) {
        this.actOnMatch(pick);
      }
      return;
    }
    if (this.activeOther !== null && (this.navigated || !empty)) {
      this.actOnOther();
      return;
    }
    const row = this.activeRow;
    if (!row || (!this.filtering && !this.navigated)) {
      if (!row && this.filtering && !this.readOnly) {
        this.runTextSearch();
      }
      return;
    }
    if (row.desk.state === 'ARRIVED') {
      if (this.filtering && this.hereEnterFor === this.query && this.searchKind === null && !this.readOnly) {
        this.hereEnterFor = null; // a second Enter on the same text: look in every file (siblings, duplicates), §11.8 step 16
        this.runTextSearch();
        return;
      }
      this.hereEnterFor = this.filtering ? this.query : null;
      this.live = this.i18n.t('fd.box.alreadyHere');
      if (this.cardMatchPatientId === row.patient.id) {
        this.markSeen(row.patient.id);
      }
      return;
    }
    if (row.desk.state === 'CLOSED' || this.readOnly || !this.permissions.can('APPOINTMENT_WRITE')) {
      return;
    }
    if (this.pendingCard && this.cardKind === 'none' && row.patient.card && !row.patient.card.onFile) {
      this.attach(row.patient, row);
      return;
    }
    this.arrive(row);
  }

  private actOnOther(): void {
    if (this.activeOther === 'new') {
      this.openQuick();
      return;
    }
    const m = this.results.find(x => `m:${x.patient.id}` === this.activeOther);
    if (m) {
      this.actOnMatch(m);
    }
  }

  /** Enter on a result: its row (a second Enter arrives it), the panel, or, for a card candidate, attach the card first. */
  private actOnMatch(m: PatientMatch): void {
    const appt = m.todayAppointments.find(a => !a.arrived);
    const row = appt ? this.rows.find(r => r.appointmentId === appt.appointmentId) ?? null : null;
    if (this.searchKind === 'card' && this.cardKind === 'candidates') {
      this.attach(m.patient, row);
      return;
    }
    if (row && (row.desk.state === 'GO' || row.desk.state === 'CHECK')) {
      if (this.searchKind === 'card') {
        this.cardMatchPatientId = m.patient.id;
      }
      if (this.cardKind === 'multi') {
        // the file is chosen: stop holding the highlight (the banner stays), or recompute() would re-pick the match
        // and every further Enter would highlight again instead of arriving (review p1b)
        this.cardKind = null;
      }
      this.highlightRow(row);
      return;
    }
    if (!appt && m.todayAppointments.length > 0) {
      this.live = this.i18n.t('fd.box.alreadyHere');
      return;
    }
    this.panel = m;
  }

  private highlightRow(row: ArrivalRow): void {
    this.forced.add(row.appointmentId);
    this.activeOther = null;
    this.activeId = row.appointmentId;
    this.navigated = true;
    this.recompute();
    this.cdr.detectChanges();
    document.querySelector(`.fd-row[data-appt="${row.appointmentId}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }

  private openFile(): void {
    let id: number | null = null;
    if (this.activeOther?.startsWith('m:')) {
      id = Number(this.activeOther.slice(2));
    } else if (this.panel) {
      id = this.panel.patient.id;
    } else {
      id = this.activeRow?.patient.id ?? null;
    }
    if (id !== null) {
      void this.router.navigate(['/patients', id]);
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

  /** The only place that gives the focus back; the box is the only element this module ever focuses (the drawer's first field apart). */
  private refocus(): void {
    this.box?.focus();
  }

  // ---------- card ----------

  /** A card number read in the box: kept in memory, the box emptied, the search waits for Enter (a scanner sends it). */
  private readCard(nam: string): void {
    this.clearBox();
    this.cardHint = false;
    this.resetResults();
    if (!this.permissions.can('HEALTH_CARD_CAPTURE')) {
      this.noCardRole = true;
      return;
    }
    this.noCardRole = false;
    this.swallowAfterCard = true;
    this.setPending(nam, true);
    this.live = this.i18n.t('fd.card.read');
  }

  private setPending(nam: string, queue: boolean): void {
    this.pendingCard = { nam, at: Date.now() };
    this.cardQueued = queue;
    if (this.cardTimer !== null) {
      clearTimeout(this.cardTimer);
    }
    this.cardTimer = setTimeout(() => this.dropPending(), CARD_TTL_MS);
  }

  /** A guarded field (quick-patient drawer, fix panel) caught a scan: same as a read in the box, without a search while a form is open. */
  private onScanned(nam: string): void {
    if (this.locked) {
      return;
    }
    if (this.drawerOpen) {
      if (this.permissions.can('HEALTH_CARD_CAPTURE')) {
        this.setPending(nam, false);
        this.live = this.i18n.t('fd.card.read');
      }
      return;
    }
    this.readCard(nam);
  }

  /** The number is gone: after use, after 2 minutes, on lock or on leaving the page. */
  dropPending(): void {
    this.pendingCard = null;
    this.cardQueued = false;
    if (this.cardTimer !== null) {
      clearTimeout(this.cardTimer);
      this.cardTimer = null;
    }
    if (this.cardBanner && this.cardBanner.kind !== 'recognised') {
      this.resetResults();
      this.recompute();
    }
  }

  private resetResults(): void {
    this.searchSub?.unsubscribe();
    this.searching = false;
    this.searchKind = null;
    this.cardKind = null;
    this.cardBanner = null;
    this.cardWarnings = [];
    this.found = [];
    this.results = [];
    this.menus = new Map();
    this.activeOther = null;
    this.panel = null;
    this.mismatch = null;
    this.inUseTarget = null;
    this.forced.clear();
    this.cardMatchPatientId = null;
  }

  private runCardSearch(): void {
    const p = this.pendingCard;
    if (!p) {
      return;
    }
    this.cardQueued = false;
    this.searching = true;
    this.searchKind = 'card';
    this.rateText = null;
    this.searchSub?.unsubscribe();
    this.searchSub = this.desk.search({ healthNumber: p.nam }).pipe(finalize(() => (this.searching = false))).subscribe({
      next: res => this.onCardResult(res),
      error: err => this.onSearchError(err, 'card')
    });
  }

  private rowFor(m: PatientMatch): ArrivalRow | null {
    const a = m.todayAppointments.find(x => !x.arrived);
    return (a ? this.rows.find(r => r.appointmentId === a.appointmentId) : null) ?? null;
  }

  private onCardResult(res: PatientSearchResult): void {
    this.resetResults();
    this.searchKind = 'card';
    this.cardWarnings = res.warnings ?? [];
    const ms = res.matches ?? [];
    const cs = res.candidates ?? [];
    if (ms.length === 1) {
      const m = ms[0];
      this.cardMatchPatientId = m.patient.id;
      this.cardBanner = { kind: 'recognised' };
      this.live = this.i18n.t('fd.card.recognised');
      const row = this.rowFor(m);
      this.found = [m];
      if (row && (row.desk.state === 'GO' || row.desk.state === 'CHECK')) {
        this.highlightRow(row);
      } else if (m.todayAppointments.length > 0 && m.todayAppointments.every(a => a.arrived)) {
        this.live = this.i18n.t('fd.box.alreadyHere');
        this.markSeen(m.patient.id);
      } else {
        this.panel = m;
      }
    } else if (ms.length >= 2) {
      this.cardKind = 'multi';
      this.found = ms;
      this.cardBanner = { kind: 'multi', count: ms.length };
    } else if (cs.length) {
      this.cardKind = 'candidates';
      this.found = cs;
      this.cardBanner = { kind: 'candidates' };
    } else {
      this.cardKind = 'none';
      this.cardBanner = { kind: 'none' };
      this.highlightNewForCard(); // §11.8 step 8: « Nouveau patient » highlighted, Enter opens the drawer with the card
    }
    this.recompute();
  }

  private highlightNewForCard(): void {
    if (this.canCreatePatient && !this.readOnly) {
      this.activeOther = 'new';
      this.activeId = null;
      this.navigated = true;
    }
  }

  private onSearchError(err: { status?: number }, kind: 'card' | 'text'): void {
    this.searching = false;
    if (err?.status === 429) {
      const secs = apiErrorOf(err)?.details?.retryAfterSeconds ?? 60;
      this.rateText = kind === 'card' ? this.i18n.t('fd.rate.card') : this.i18n.t('fd.rate.search', { minutes: Math.max(1, Math.ceil(secs / 60)) });
      this.searchKind = null;
      return;
    }
    this.searchKind = null;
    if (this.namCollectionOff(err)) {
      return;
    }
    this.actionError = this.errors.text(err, kind === 'card' ? 'fd.error.card' : 'fd.search.error');
    this.refocus();
  }

  /**
   * 409 NAM_COLLECTION_OFF (PRIV-A-40, decision P1 not recorded): the clinic does not record health numbers. The number held in
   * memory is dropped (Enter must not send it again), the box is already empty, and the desk is told to search by name.
   */
  private namCollectionOff(err: unknown): boolean {
    if ((err as { status?: number } | null)?.status !== 409 || apiErrorOf(err)?.error !== 'NAM_COLLECTION_OFF') {
      return false;
    }
    this.dropPending();
    this.cardHint = false;
    this.actionError = this.i18n.t('fd.namCollectionOff');
    this.refocus();
    return true;
  }

  /** Sends the card to a file (no number on file yet), then notes the arrival when there is an appointment today. */
  private attach(patient: DeskPatient, row: ArrivalRow | null, reason: SharedCardReason | null = null): void {
    const nam = this.pendingCard?.nam;
    if (!nam || this.attaching) {
      return;
    }
    this.attaching = true;
    this.actionError = null;
    const body: HealthCardRequest = { healthNumber: nam };
    if (reason) {
      body.sharedCardReason = reason;
    }
    this.desk.setHealthCard(patient.id, body).pipe(finalize(() => (this.attaching = false))).subscribe({
      next: res => {
        const warnings = res.warnings ?? [];
        this.dropPending();
        this.resetResults();
        if (row && (row.desk.state === 'GO' || row.desk.state === 'CHECK') && this.permissions.can('APPOINTMENT_WRITE')) {
          this.arrive(row, { cardAttached: true, cardStatus: res.card.status });
          return;
        }
        this.clearBox();
        this.searchKind = 'created';
        const m: PatientMatch = { patient: { ...patient, card: res.card }, matchedBy: 'HEALTH_NUMBER', todayAppointments: [] };
        this.found = [m];
        this.panel = m;
        this.cardWarnings = warnings;
        this.activeOther = `m:${patient.id}`;
        this.recompute();
        this.refocus();
      },
      error: err => this.onAttachError(err, patient, row)
    });
  }

  private onAttachError(err: { status?: number }, patient: DeskPatient, row: ArrivalRow | null): void {
    const api = apiErrorOf(err);
    if (err?.status === 409 && api?.error === 'HEALTH_NUMBER_MISMATCH') {
      this.resetResultsKeepCard();
      this.searchKind = 'card';
      this.cardBanner = { kind: 'mismatch' };
      this.mismatch = { row };
      this.recompute();
      this.refocus();
      return;
    }
    if (err?.status === 409 && api?.error === 'HEALTH_NUMBER_IN_USE') {
      this.resetResultsKeepCard();
      this.searchKind = 'card';
      this.found = api.details?.candidates ?? [];
      this.inUseTarget = { patient, row };
      this.cardBanner = { kind: 'inUse', underOne: this.isUnderOne(patient) };
      this.recompute();
      this.refocus();
      return;
    }
    if (err?.status === 429) {
      this.onSearchError(err, 'card');
      return;
    }
    if (this.namCollectionOff(err)) {
      return;
    }
    this.fail(err, 'fd.error.card');
  }

  /** Clears the results but keeps the number in memory: the next choice may still need it. */
  private resetResultsKeepCard(): void {
    const keep = this.pendingCard;
    this.resetResults();
    this.pendingCard = keep;
  }

  private isUnderOne(p: DeskPatient): boolean {
    if (!p.dateOfBirth) {
      return false;
    }
    const t = businessToday();
    return p.dateOfBirth > `${Number(t.slice(0, 4)) - 1}${t.slice(4)}`;
  }

  /** « Autre raison » / « Enfant de moins d'un an… » on a number already in use: the same attach, with its reason. */
  onReason(reason: SharedCardReason): void {
    if (this.inUseTarget) {
      this.attach(this.inUseTarget.patient, this.inUseTarget.row, reason);
    }
  }

  /** « Noter l'arrivée sans la carte »: the arrival alone; the card is not touched. */
  noteWithoutCard(): void {
    const row = this.mismatch?.row;
    if (!row) {
      return;
    }
    this.dropPending();
    this.resetResults();
    this.arrive(row);
  }

  private markSeen(patientId: number): void {
    this.cardMatchPatientId = null;
    this.desk.setHealthCard(patientId, { seen: true }).subscribe({ error: () => undefined }); // a convenience stamp: never an error for the desk
  }

  /** « Utiliser ce dossier » on a result: its row or its panel. */
  useResult(m: PatientMatch): void {
    this.actOnMatch(m);
    this.refocus();
  }

  // ---------- text search ----------

  /** « Chercher dans tous les dossiers » while the typed text also matches rows of the day. */
  searchAll(): void {
    this.runTextSearch();
    this.refocus();
  }

  private runTextSearch(): void {
    const text = this.query.trim();
    const today = businessToday();
    const dob = parseBirthDate(text, today);
    const digits = text.replace(/[\s.()\-]/g, '');
    let body: PatientSearchRequest | null = null;
    if (dob) {
      body = { dateOfBirth: dob };
    } else if (/^\d{4,10}$/.test(digits)) {
      body = { phoneDigits: digits };
    } else if (this.letters(text).length >= 2 || text.length >= 2) {
      body = { query: text };
    }
    if (!body) {
      return;
    }
    const sentFor = this.query;
    this.rateText = null;
    this.searching = true;
    this.searchSub?.unsubscribe();
    this.searchSub = this.desk.search(body).pipe(finalize(() => (this.searching = false))).subscribe({
      next: res => {
        if (this.query !== sentFor) {
          return; // the text changed while the answer was on its way
        }
        this.resetResults();
        this.searchKind = 'text';
        this.found = res.matches ?? [];
        for (const m of this.found) {
          for (const a of m.todayAppointments) {
            this.forced.add(a.appointmentId); // arrived ones too, so the row shows under « Sur place »
          }
        }
        this.activeOther = this.found.length ? `m:${this.found[0].patient.id}` : this.canCreatePatient ? 'new' : null;
        this.recompute();
      },
      error: err => this.onSearchError(err, 'text')
    });
  }

  // ---------- duplicate flags ----------

  onMenu(m: PatientMatch, key: string): void {
    if (!key.startsWith('dup:')) {
      return;
    }
    const other = this.found.find(x => x.patient.id === Number(key.slice(4)));
    if (other) {
      this.flag([[m, other]]);
    }
  }

  flagChoices(): void {
    const [first, ...rest] = this.found;
    if (first && rest.length) {
      this.flag(rest.map(o => [first, o] as [PatientMatch, PatientMatch]));
    }
  }

  private flag(pairs: [PatientMatch, PatientMatch][]): void {
    this.attaching = true;
    forkJoin(pairs.map(([a, b]) => this.desk.flagDuplicate(a.patient.id, b.patient.id))).pipe(finalize(() => (this.attaching = false))).subscribe({
      next: () => {
        const ids = new Set(pairs.flatMap(([a, b]) => [a.patient.id, b.patient.id]));
        const mark = (p: DeskPatient): DeskPatient => (ids.has(p.id) ? { ...p, possibleDuplicate: true } : p);
        this.found = this.found.map(m => ({ ...m, patient: mark(m.patient) }));
        this.rows = this.rows.map(r => ({ ...r, patient: mark(r.patient) }));
        this.live = this.i18n.t('fd.card.flagged');
        this.recompute();
        this.refocus();
      },
      error: err => this.fail(err, 'fd.error.flag')
    });
  }

  // ---------- quick patient ----------

  openQuick(): void {
    if (!this.canCreatePatient) {
      return;
    }
    const text = this.query.trim();
    const p: QuickPrefill = { firstName: '', lastName: '', dateOfBirth: '', phone: '' };
    if (text && !maybeNam(text)) {
      const dob = parseBirthDate(text, businessToday());
      if (dob) {
        p.dateOfBirth = dob;
      } else if (/^\d{4,10}$/.test(text.replace(/[\s.()\-]/g, ''))) {
        p.phone = text;
      } else {
        const tokens = text.split(/\s+/).filter(Boolean);
        p.lastName = tokens[tokens.length - 1] ?? '';
        p.firstName = tokens.slice(0, -1).join(' ');
      }
    }
    this.prefill = p;
    this.drawerOpen = true;
  }

  closeQuick(): void {
    this.drawerOpen = false;
    this.refocus();
  }

  onCardRemoved(): void {
    this.dropPending();
  }

  onUseMatch(m: PatientMatch): void {
    this.drawerOpen = false;
    this.dropPending();
    this.clearBox();
    this.resetResults();
    this.searchKind = 'created';
    this.found = [m];
    this.activeOther = `m:${m.patient.id}`;
    this.recompute();
    this.actOnMatch(m);
    this.refocus();
  }

  onCreated(res: QuickPatientResponse): void {
    this.drawerOpen = false;
    const p = res.patient;
    this.recent = { id: p.id, name: `${p.firstName} ${p.lastName}`, lastName: p.lastName, at: Date.now() };
    this.dropPending();
    this.clearBox();
    this.resetResults();
    this.searchKind = 'created';
    this.cardWarnings = res.warnings ?? [];
    const m: PatientMatch = { patient: p, matchedBy: 'NAME', todayAppointments: [] };
    this.found = [m];
    this.panel = m;
    this.activeOther = `m:${p.id}`;
    this.recompute();
    this.refocus();
  }

  // ---------- walk-in ----------

  openWalkIn(m: PatientMatch): void {
    this.walkInFor = m.patient;
    this.walkInChoice = readWalkInChoice(this.data?.walkInOptions);
    this.clearBox(); // Enter with an empty box now creates the visit
    this.refocus();
  }

  cancelWalkIn(): void {
    this.walkInFor = null;
    this.refocus();
  }

  onWalkInChoice(c: WalkInChoice): void {
    this.walkInChoice = c;
  }

  private cycleType(): void {
    const i = WALK_IN_TYPES.indexOf(this.walkInChoice.type);
    this.walkInChoice = { ...this.walkInChoice, type: WALK_IN_TYPES[(i + 1) % WALK_IN_TYPES.length] };
  }

  createWalkIn(): void {
    const p = this.walkInFor;
    if (!p || this.walkBusy) {
      return;
    }
    this.walkBusy = true;
    this.actionError = null;
    this.arrivals.walkIn({ patientId: p.id, type: this.walkInChoice.type, specialty: this.walkInChoice.specialty })
      .pipe(finalize(() => (this.walkBusy = false))).subscribe({
        next: row => {
          this.walkInFor = null;
          this.resetResults();
          this.clearBox();
          this.rows = [...this.rows.filter(r => r.appointmentId !== row.appointmentId), row];
          this.recompute();
          const name = `${p.firstName} ${p.lastName.charAt(0)}.`;
          this.live = this.i18n.t('appts.live.arrived', { name: `${p.firstName} ${p.lastName}` });
          this.lastAction = { kind: 'walkIn', id: row.appointmentId };
          this.pushToast(this.i18n.t('fd.toast.walkIn', { name }), true);
          this.refocus();
          this.load();
        },
        error: err => this.fail(err, 'fd.error.walkIn')
      });
  }

  // ---------- actions ----------

  arrive(row: ArrivalRow, opts: ArriveOpts = {}): void {
    if (this.busy.has(row.appointmentId)) {
      return;
    }
    this.busy.add(row.appointmentId);
    this.pending++;
    this.actionError = null;
    const queryAtStart = this.query;
    const seen = !opts.cardAttached && this.cardMatchPatientId === row.patient.id;
    this.arrivals.arrive(row.appointmentId).pipe(finalize(() => { this.pending--; this.busy.delete(row.appointmentId); })).subscribe({
      next: r => {
        this.replace(r);
        const name = `${row.patient.firstName} ${row.patient.lastName.charAt(0)}.`;
        this.live = this.i18n.t('appts.live.arrived', { name: `${row.patient.firstName} ${row.patient.lastName}` });
        this.cardHint = false;
        this.lastAction = { kind: 'arrival', ids: [row.appointmentId], cardPatientId: opts.cardAttached ? row.patient.id : null };
        const status: CardStatus | undefined = opts.cardStatus ?? row.patient.card?.status;
        this.expiryPrompt = (opts.cardAttached || seen) && (status === 'UNKNOWN' || status === 'EXPIRED') ? { patientId: row.patient.id, name } : null;
        this.expiryEcho = null;
        const related = (row.relatedAppointmentIds ?? [])
          .map(id => this.rows.find(x => x.appointmentId === id))
          .filter((x): x is ArrivalRow => !!x && (x.desk.state === 'GO' || x.desk.state === 'CHECK'));
        this.familyPrompt = related.length
          ? { ids: related.map(x => x.appointmentId), names: related.map(x => `${x.patient.firstName} (${fmtClock(x.scheduledAt.substring(11, 16), this.i18n.lang)})`).join(', ') }
          : null;
        this.pushToast(this.i18n.t(opts.cardAttached ? 'fd.toast.arrivedCard' : 'fd.toast.arrived', { name }), true);
        if (seen) {
          this.markSeen(row.patient.id);
        }
        const consumed = !!opts.cardAttached || seen;
        if (this.query === queryAtStart) {
          this.clearBox(); // not when the user already started typing the next name
        }
        this.resetResults();
        if (consumed) {
          this.dropPending();
        }
        this.refocus();
        this.load();
      },
      error: err => this.fail(err, 'appts.error.arrive')
    });
  }

  /** « Aussi : Léa, Noah — Entrée »: one arrival each, undone together. */
  private arriveFamily(): void {
    const f = this.familyPrompt;
    if (!f || this.readOnly || !this.permissions.can('APPOINTMENT_WRITE')) {
      return;
    }
    this.familyPrompt = null;
    this.actionError = null;
    const ids = f.ids.filter(id => !this.busy.has(id));
    if (!ids.length) {
      return;
    }
    ids.forEach(id => this.busy.add(id));
    this.pending++;
    // each arrival on its own: one refusal (another desk closed it) must not lose the undo of the others (review p1b)
    forkJoin(ids.map(id => this.arrivals.arrive(id).pipe(
      map(r => ({ id, row: r as ArrivalRow | null, err: null as unknown })),
      catchError(err => of({ id, row: null as ArrivalRow | null, err }))
    ))).pipe(finalize(() => {
      ids.forEach(id => this.busy.delete(id));
      this.pending--;
    })).subscribe(results => {
      const ok = results.filter(x => x.row !== null);
      for (const x of ok) {
        const r = x.row as ArrivalRow;
        this.rows = this.rows.map(y => (y.appointmentId === r.appointmentId ? r : y));
      }
      this.recompute();
      this.expiryPrompt = null;
      if (ok.length) {
        this.lastAction = { kind: 'arrival', ids: ok.map(x => x.id), cardPatientId: null };
        this.pushToast(this.i18n.t('fd.toast.familyArrived', { names: f.names }), true);
      }
      const failed = results.find(x => x.row === null);
      if (failed) {
        this.fail(failed.err, 'appts.error.arrive');
      }
      this.refocus();
      this.load();
    });
  }

  undoRow(row: ArrivalRow): void {
    if (this.busy.has(row.appointmentId)) {
      return;
    }
    if (row.walkIn) {
      this.undoWalkIn(row.appointmentId);
      return;
    }
    this.busy.add(row.appointmentId);
    this.pending++;
    this.actionError = null;
    this.arrivals.undo(row.appointmentId).pipe(finalize(() => { this.pending--; this.busy.delete(row.appointmentId); })).subscribe({
      next: r => {
        this.replace(r);
        this.live = this.i18n.t('appts.live.arrivalUndone', { name: `${row.patient.firstName} ${row.patient.lastName}` });
        this.afterUndo('fd.toast.undone');
        this.load();
      },
      error: err => this.fail(err, 'appts.error.arrive')
    });
  }

  private undoWalkIn(id: number): void {
    this.busy.add(id);
    this.pending++;
    this.actionError = null;
    this.arrivals.undoWalkIn(id).pipe(finalize(() => { this.pending--; this.busy.delete(id); })).subscribe({
      next: r => {
        this.afterUndo(r.result === 'REMOVED' ? 'fd.toast.walkInRemoved' : 'fd.toast.walkInCancelled');
        this.load();
      },
      error: err => this.fail(err, 'fd.error.undo')
    });
  }

  private afterUndo(key: 'fd.toast.undone' | 'fd.toast.undoneMany' | 'fd.toast.walkInRemoved' | 'fd.toast.walkInCancelled'): void {
    this.lastAction = null;
    this.expiryPrompt = null;
    this.familyPrompt = null;
    this.expiryEcho = null;
    this.pushToast(this.i18n.t(key), false);
    this.refocus();
  }

  /** Toast or Ctrl+Z: the last action as a whole (an arrival with its card, several arrivals, or a walk-in). */
  undoLast(): void {
    const a = this.lastAction;
    if (!a) {
      return;
    }
    if (a.kind === 'walkIn') {
      this.undoWalkIn(a.id);
      return;
    }
    if (a.ids.length === 1 && a.cardPatientId === null) {
      const row = this.rows.find(r => r.appointmentId === a.ids[0]);
      if (row) {
        this.undoRow(row);
      }
      return;
    }
    this.pending++;
    this.actionError = null;
    const calls = a.ids.map(id => this.arrivals.undo(id));
    if (a.cardPatientId !== null) {
      // the number is removed with the arrival; outside its 10-minute window the server refuses and the card simply stays
      calls.push(this.desk.removeHealthCard(a.cardPatientId).pipe(catchError(() => of(null))) as never);
    }
    forkJoin(calls).pipe(finalize(() => this.pending--)).subscribe({
      next: () => {
        this.afterUndo(a.ids.length > 1 ? 'fd.toast.undoneMany' : 'fd.toast.undone');
        this.load();
      },
      error: err => this.fail(err, 'fd.error.undo')
    });
  }

  // ---------- toast ----------

  private pushToast(message: string, undoable: boolean): void {
    this.toastBase = message;
    this.toastUndoable = undoable;
    this.renderToast();
  }

  private renderToast(): void {
    const lines: string[] = [];
    if (this.expiryPrompt) {
      lines.push(this.expiryEcho ?? this.i18n.t('fd.toast.expiryAsk'));
    }
    if (this.familyPrompt) {
      lines.push(this.i18n.t('fd.toast.family', { names: this.familyPrompt.names }));
    }
    this.toast = { id: ++this.seq, message: this.toastBase, undoable: this.toastUndoable, lines, ms: lines.length ? ASK_TOAST_MS : TOAST_MS };
  }

  /** While the expiry question is up, a text that reads as an expiry is echoed with the month spelled out. */
  private updateExpiryEcho(): void {
    if (!this.expiryPrompt) {
      return;
    }
    const text = this.query.trim();
    const ym = text ? parseCardExpiry(text, businessToday()) : null;
    let echo: string | null = null;
    if (ym) {
      echo = this.i18n.t('fd.toast.expiryEcho', { date: cardExpiryLabel(ym, this.i18n.lang), name: this.expiryPrompt.name });
    } else if (/^\d{2}[\s\-/]?\d{2,4}$/.test(text)) {
      echo = this.i18n.t('fd.toast.expiryCheck');
    }
    if (echo !== this.expiryEcho) {
      this.expiryEcho = echo;
      this.renderToast();
    }
  }

  private saveExpiryFromBox(ym: string): void {
    const p = this.expiryPrompt;
    if (!p) {
      return;
    }
    this.actionError = null;
    this.desk.setHealthCard(p.patientId, { cardExpiry: ym }).subscribe({
      next: res => {
        this.expiryPrompt = null;
        this.expiryEcho = null;
        this.lastAction = null;
        this.pushToast(this.i18n.t('fd.toast.expirySaved'), false);
        if (res?.card && this.toast) { // §11.8 step 5: the resulting card chip (glyph + word), e.g. « ✓ Carte au dossier »
          const c = cardChip(res.card);
          this.toast = { ...this.toast, lines: [`${c.glyph} ${this.i18n.t(c.label)}`] };
        }
        this.clearBox();
        this.refocus();
        this.load();
      },
      error: err => this.fail(err, 'fd.error.expiry')
    });
  }

  onToastDone(): void {
    this.toast = null;
    this.lastAction = null;
    this.expiryPrompt = null;
    this.expiryEcho = null;
    this.familyPrompt = null;
  }

  private fail(err: { status?: number }, fallback: 'appts.error.arrive' | 'fd.error.card' | 'fd.error.walkIn' | 'fd.error.expiry' | 'fd.error.flag' | 'fd.error.undo' = 'appts.error.arrive'): void {
    this.actionError = this.errors.text(err, fallback);
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

  onExpirySaved(): void {
    this.refocus();
    this.load();
  }

  onRowChanged(r: ArrivalRow): void {
    this.replace(r);
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
      if ((e.target as HTMLElement | null)?.closest?.('.send-link__menu, .row-menu-wrap')) {
        return; // the menus close themselves
      }
      this.escape();
      return;
    }
    const typing = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (typing && !this.drawerOpen && (document.activeElement === document.body || document.activeElement === null)) {
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
    } else if (this.walkInFor) {
      this.cancelWalkIn();
    } else if (this.panel) {
      this.panel = null;
      this.refocus();
    } else {
      this.cardHint = false;
      this.noCardRole = false;
      this.rateText = null;
      this.dropPending();
      this.resetResults();
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
    this.lastAction = null;
    this.expiryPrompt = null;
    this.expiryEcho = null;
    this.familyPrompt = null;
    this.cardHint = false;
    this.noCardRole = false;
    this.rateText = null;
    this.drawerOpen = false;
    this.walkInFor = null;
    this.recent = null;
    this.dropPending();
    this.resetResults();
    this.clearBox();
    this.selectionText = ''; // no name may stay in the live regions behind the mask
    this.live = '';
    this.listSub?.unsubscribe(); // no request while masked, not even one that was already running
  }
}
