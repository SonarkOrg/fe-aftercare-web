import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { AppointmentService } from '../../Services/Appointment.service';
import { ArrivalService } from '../../Services/Arrival.service';
import { ApiErrorsService } from '../../i18n/api-errors';
import { enumKey } from '../../i18n/enum-key';
import { fmtClock, fmtPct } from '../../i18n/format';
import { I18nService } from '../../i18n/i18n.service';
import { Appointment, AppointmentMetrics } from '../../models/appointment.model';
import { addDays, mondayOf, businessToday } from '../../shared/link.util';
import { appointmentChip as baseChip, ChipSpec, GLYPH } from '../../shared/status';
import { BoardGroup, MINUTES_SAVED_PER_INTAKE, Week, endTime, groupForBoard, isOpenToday, layoutWeek } from './appointment-board';

/** Per browser, never PHI: the view the secretary used last (§7.1). */
export const VIEW_STORAGE_KEY = 'aftercare.appts.view';
type RememberedView = 'day' | 'week' | 'arrivals';

interface DayGroup {
  date: string;
  items: Appointment[];
}

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.component.html'
})
export class AppointmentsComponent implements OnInit, OnDestroy {
  private loadSub?: Subscription;
  private querySub?: Subscription;
  private all: Appointment[] = [];
  private busy = new Set<number>();
  date = businessToday();
  view: 'day' | 'week' = 'day';
  groups: DayGroup[] = [];
  count = 0;
  metrics: AppointmentMetrics | null = null;
  loading = false;
  errorMessage: string | null = null;
  /** Same chip as the badge: a SCHEDULED walk-in without a questionnaire is neutral « Sans questionnaire », not « awaiting ». */
  appointmentChip = (a: Appointment): ChipSpec =>
    a.status === 'SCHEDULED' && a.questionnaireDefinitionId === null
      ? { tone: 'neutral', glyph: GLYPH.neutral, label: { key: 'appts.noQuestionnaire' } }
      : baseChip(a);
  endTime = endTime;
  minutesPerIntake = MINUTES_SAVED_PER_INTAKE;
  board: BoardGroup[] = [];
  week: Week | null = null;
  metricsTitle: 'common.today' | 'appts.thisWeek' = 'common.today';
  rangeFrom = businessToday();
  rangeTo = businessToday();
  actionError: string | null = null;
  live = '';
  codes: Record<number, string> = {};

  constructor(
    private appointments: AppointmentService,
    private arrivals: ArrivalService,
    public i18n: I18nService,
    private errors: ApiErrorsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  typeLabel(a: Appointment): string {
    return this.i18n.t(enumKey('appointmentType', a.type));
  }

  blockTitle(a: Appointment): string {
    return `${this.time(a)} ${a.patientFirstName} ${a.patientLastName} · ${this.i18n.t(this.appointmentChip(a).label)}`;
  }

  hourLabel(h: number): string {
    return fmtClock(`${h}:00`, this.i18n.lang);
  }

  ngOnInit(): void {
    // The view lives in the URL (?view=day|week), so the links are plain router links and a reload keeps it.
    this.querySub = this.route.queryParamMap.subscribe(q => this.onViewParam(q.get('view')));
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  private onViewParam(raw: string | null): void {
    if (raw === null) {
      // No explicit view: open the one used last. Arrivals is another route; anything else is day.
      const last = this.remembered();
      if (last === 'arrivals') {
        void this.router.navigate(['/appointments/arrivals'], { replaceUrl: true });
        return;
      }
      this.showView(last === 'week' ? 'week' : 'day');
      return;
    }
    const v = raw === 'week' ? 'week' : 'day';
    this.remember(v);
    this.showView(v);
  }

  /**
   * Programmatic switch (state and data only; the view links navigate to ?view= instead and the component follows the URL).
   * Kept because the shared i18n specs (pseudo-locale, French rendering) switch the view this way.
   */
  setView(v: 'day' | 'week'): void {
    this.remember(v);
    this.showView(v);
  }

  private showView(v: 'day' | 'week'): void {
    this.view = v;
    this.metricsTitle = v === 'week' ? 'appts.thisWeek' : 'common.today';
    this.load();
  }

  private remembered(): RememberedView | null {
    try {
      const v = localStorage.getItem(VIEW_STORAGE_KEY);
      return v === 'day' || v === 'week' || v === 'arrivals' ? v : null;
    } catch {
      return null;
    }
  }

  remember(v: RememberedView): void {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* private window or blocked storage: the view is simply not remembered */
    }
  }

  canArrive(a: Appointment): boolean {
    return !a.arrivedAt && isOpenToday(a);
  }

  canUndoArrival(a: Appointment): boolean {
    return !!a.arrivedAt && isOpenToday(a);
  }

  isBusy(a: Appointment): boolean {
    return this.busy.has(a.id);
  }

  arrive(a: Appointment): void {
    this.runArrival(a, this.arrivals.arrive(a.id), 'appts.live.arrived');
  }

  undoArrival(a: Appointment): void {
    this.runArrival(a, this.arrivals.undo(a.id), 'appts.live.arrivalUndone');
  }

  /** Arrival and its undo never ask for confirmation (D5); the row is updated in place from the answer. */
  private runArrival(a: Appointment, obs: ReturnType<ArrivalService['arrive']>, live: 'appts.live.arrived' | 'appts.live.arrivalUndone'): void {
    if (this.busy.has(a.id)) {
      return;
    }
    this.busy.add(a.id);
    this.actionError = null;
    obs.subscribe({
      next: row => {
        this.busy.delete(a.id);
        a.arrivedAt = row.arrival?.arrivedAt ?? null;
        a.arrivalSource = row.arrival?.source ?? null;
        this.board = groupForBoard(this.all);
        this.live = this.i18n.t(live, { name: `${a.patientFirstName} ${a.patientLastName}` });
      },
      error: err => {
        this.busy.delete(a.id);
        if (err?.status === 409 || err?.status === 404) { // closed, wrong day or deleted by another desk
          this.load();
        }
        this.actionError = this.errors.text(err, 'appts.error.arrive');
      }
    });
  }

  get range(): { from: string; to: string } {
    if (this.view === 'week') {
      const from = mondayOf(this.date);
      return { from, to: addDays(from, 6) };
    }
    return { from: this.date, to: this.date };
  }

  get completionRatio(): number {
    return this.metrics?.completionRate ?? 0;
  }

  get completionPercent(): string {
    const r = this.metrics?.completionRate;
    return fmtPct(r, this.i18n.lang);
  }

  hours(w: Week): number[] {
    const out: number[] = [];
    for (let h = w.startHour; h < w.endHour; h++) {
      out.push(h);
    }
    return out;
  }

  setToday(): void {
    this.setDate(businessToday());
  }

  get doneBeforeVisit(): number {
    const m = this.metrics;
    return m ? m.total - m.cancelled : 0;
  }

  /** Same rule as the server's linkUsable: open, SCHEDULED, and the appointment day has not ended (spec 5.6). */
  canRegenerate(a: Appointment): boolean {
    return a.status === 'SCHEDULED' && a.questionnaireDefinitionId !== null && a.scheduledAt.substring(0, 10) >= businessToday();
  }

  endOf(a: Appointment): string {
    return fmtClock(endTime(a.scheduledAt, a.durationMinutes), this.i18n.lang);
  }

  markReviewed(a: Appointment): void {
    this.act(this.appointments.markReviewed(a.id), this.i18n.t('dashboard.live.reviewed'));
  }

  markCompleted(a: Appointment): void {
    if (!window.confirm(this.i18n.t('appts.confirmComplete'))) {
      return;
    }
    this.act(this.appointments.setStatus(a.id, 'COMPLETED'), this.i18n.t('appts.live.completed'));
  }

  newLink(a: Appointment): void {
    if (!window.confirm(this.i18n.t('dashboard.confirmNewLink'))) {
      return;
    }
    this.actionError = null;
    this.appointments.regenerateCode(a.id).subscribe({
      next: res => (this.codes = res.accessCode ? { ...this.codes, [a.id]: res.accessCode } : this.codes),
      error: err => this.fail(err)
    });
  }

  private act(obs: ReturnType<AppointmentService['markReviewed']>, message: string): void {
    this.actionError = null;
    obs.subscribe({
      next: () => {
        this.live = message;
        this.load();
      },
      error: err => this.fail(err)
    });
  }

  private fail(err: { status?: number }): void {
    if (err?.status === 409) {
      this.actionError = this.i18n.t('dashboard.error.apptConflict');
      this.load();
    } else {
      this.actionError = this.errors.text(err, 'appts.error.update');
    }
  }

  setDate(d: string): void {
    if (d) {
      this.date = d;
      this.load();
    }
  }

  shift(direction: 1 | -1): void {
    this.date = addDays(this.date, direction * (this.view === 'week' ? 7 : 1));
    this.load();
  }

  time(a: Appointment): string {
    return fmtClock(a.scheduledAt.substring(11, 16), this.i18n.lang);
  }

  load(): void {
    const { from, to } = this.range;
    this.loading = true;
    this.errorMessage = null;
    this.actionError = null;
    this.loadSub?.unsubscribe();
    this.loadSub = forkJoin({ list: this.appointments.list(from, to), metrics: this.appointments.metrics(from, to) }).subscribe({
      next: r => {
        this.metrics = r.metrics;
        this.count = r.list.length;
        this.all = r.list;
        this.board = groupForBoard(r.list);
        this.week = this.view === 'week' ? layoutWeek(r.list, from, { lang: this.i18n.lang }) : null;
        this.rangeFrom = from;
        this.rangeTo = to;
        const byDate = new Map<string, Appointment[]>();
        for (const a of r.list) {
          const d = a.scheduledAt.substring(0, 10);
          byDate.set(d, [...(byDate.get(d) ?? []), a]);
        }
        this.groups = Array.from(byDate, ([date, items]) => ({ date, items }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.groups = [];
        this.count = 0;
        this.all = [];
        this.metrics = null;
        this.board = [];
        this.week = null;
        this.errorMessage = this.i18n.t('appts.error.load');
      }
    });
  }
}
