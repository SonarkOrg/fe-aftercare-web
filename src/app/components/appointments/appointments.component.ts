import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { AppointmentService } from '../../Services/Appointment.service';
import { Appointment, AppointmentMetrics } from '../../models/appointment.model';
import { addDays, humanize, mondayOf, businessNow, businessToday } from '../../shared/link.util';
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
  humanize = humanize;
  appointmentChip = appointmentChip;
  endTime = endTime;
  minutesPerIntake = MINUTES_SAVED_PER_INTAKE;
  board: BoardGroup[] = [];
  week: Week | null = null;
  metricsTitle = 'Today';
  rangeFrom = new Date();
  rangeTo = new Date();
  actionError: string | null = null;
  live = '';
  codes: Record<number, string> = {};

  constructor(private appointments: AppointmentService) {}

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
    return r === null || r === undefined ? '—' : `${Math.round(r * 100)}%`;
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

  /** A local Date from the y/m/d parts of a YYYY-MM-DD string (never from scheduledAt). */
  private localDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  get doneBeforeVisit(): number {
    const m = this.metrics;
    return m ? m.total - m.cancelled : 0;
  }

  canRegenerate(a: Appointment): boolean {
    return a.scheduledAt > businessNow();
  }

  endOf(a: Appointment): string {
    return endTime(a.scheduledAt, a.durationMinutes);
  }

  markReviewed(a: Appointment): void {
    this.act(this.appointments.markReviewed(a.id), 'Appointment marked reviewed.');
  }

  markCompleted(a: Appointment): void {
    if (!window.confirm('Mark this appointment as completed?')) {
      return;
    }
    this.act(this.appointments.setStatus(a.id, 'COMPLETED'), 'Appointment marked completed.');
  }

  newLink(a: Appointment): void {
    if (!window.confirm('The previous link will stop working. Continue?')) {
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
      this.actionError = 'This appointment was updated by someone else. Reloading.';
      this.load();
    } else {
      this.actionError = 'Could not update the appointment.';
    }
  }

  setView(v: 'day' | 'week'): void {
    this.view = v;
    this.metricsTitle = v === 'week' ? 'This week' : 'Today';
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
    return a.scheduledAt.substring(11, 16);
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
        this.week = this.view === 'week' ? layoutWeek(r.list, from) : null;
        this.rangeFrom = this.localDate(from);
        this.rangeTo = this.localDate(to);
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
        this.errorMessage = 'Could not load appointments.';
      }
    });
  }
}
