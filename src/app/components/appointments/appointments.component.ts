import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { AppointmentService } from '../../Services/Appointment.service';
import { Appointment, AppointmentMetrics } from '../../models/appointment.model';
import { addDays, humanize, mondayOf, todayLocalIsoDate } from '../../shared/link.util';

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
  date = todayLocalIsoDate();
  view: 'day' | 'week' = 'day';
  groups: DayGroup[] = [];
  count = 0;
  metrics: AppointmentMetrics | null = null;
  loading = false;
  errorMessage: string | null = null;
  humanize = humanize;

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

  get completionPercent(): string {
    const r = this.metrics?.completionRate;
    return r === null || r === undefined ? '—' : `${Math.round(r * 100)}%`;
  }

  setView(v: 'day' | 'week'): void {
    this.view = v;
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
    this.loadSub?.unsubscribe();
    this.loadSub = forkJoin({ list: this.appointments.list(from, to), metrics: this.appointments.metrics(from, to) }).subscribe({
      next: r => {
        this.metrics = r.metrics;
        this.count = r.list.length;
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
        this.errorMessage = 'Could not load appointments.';
      }
    });
  }
}
