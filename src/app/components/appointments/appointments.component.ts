import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { AppointmentService } from '../../Services/Appointment.service';
import { ApiErrorsService } from '../../i18n/api-errors';
import { enumKey } from '../../i18n/enum-key';
import { fmtClock, fmtPct } from '../../i18n/format';
import { I18nService } from '../../i18n/i18n.service';
import { Appointment, AppointmentMetrics } from '../../models/appointment.model';
import { addDays, mondayOf, businessNow, businessToday } from '../../shared/link.util';
import { appointmentChip } from '../../shared/status';
import { BoardGroup, MINUTES_SAVED_PER_INTAKE, Week, endTime, groupForBoard, layoutWeek } from './appointment-board';

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
  date = businessToday();
  view: 'day' | 'week' = 'day';
  groups: DayGroup[] = [];
  count = 0;
  metrics: AppointmentMetrics | null = null;
  loading = false;
  errorMessage: string | null = null;
  appointmentChip = appointmentChip;
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

  constructor(private appointments: AppointmentService, public i18n: I18nService, private errors: ApiErrorsService) {}

  typeLabel(a: Appointment): string {
    return this.i18n.t(enumKey('appointmentType', a.type));
  }

  blockTitle(a: Appointment): string {
    return `${this.time(a)} ${a.patientFirstName} ${a.patientLastName} · ${this.i18n.t(appointmentChip(a).label)}`;
  }

  hourLabel(h: number): string {
    return fmtClock(`${h}:00`, this.i18n.lang);
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
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

  canRegenerate(a: Appointment): boolean {
    return a.scheduledAt > businessNow();
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
      next: res => (this.codes = { ...this.codes, [a.id]: res.accessCode }),
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

  setView(v: 'day' | 'week'): void {
    this.view = v;
    this.metricsTitle = v === 'week' ? 'appts.thisWeek' : 'common.today';
    this.load();
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
        this.metrics = null;
        this.board = [];
        this.week = null;
        this.errorMessage = this.i18n.t('appts.error.load');
      }
    });
  }
}
