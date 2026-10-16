import { Component, HostListener, OnInit } from '@angular/core';
import { Observable, catchError, combineLatest, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertCountService } from '../../Services/AlertCount.service';
import { AlertService } from '../../Services/Alert.service';
import { AppointmentService } from '../../Services/Appointment.service';
import { CareDataService } from '../../Services/CareData.service';
import { SettingsService } from '../../Services/Settings.service';
import { Permissions } from '../../auth/permissions.service';
import { StaffAuth } from '../../auth/staff-auth';
import { ApiErrorsService } from '../../i18n/api-errors';
import { fmtClock, fmtDate, fmtList, fmtNum } from '../../i18n/format';
import { I18nService } from '../../i18n/i18n.service';
import { Msg } from '../../i18n/i18n.types';
import { enumKey } from '../../i18n/enum-key';
import { Alert } from '../../models/alert.model';
import { Appointment, AppointmentMetrics } from '../../models/appointment.model';
import { CareSnapshot, PatientRow } from '../../shared/care.model';
import { addDays, businessHour, businessNow, businessToday } from '../../shared/link.util';
import { STATUS_RANK, chartTodayDay } from '../../shared/patient-status';
import { alertQuestion } from '../../i18n/content';
import { alertAnswer } from '../../shared/alert.util';
import { ChipSpec, appointmentChip, severityChip } from '../../shared/status';
import {
  ActiveStats, ProgressSegments, ToPrepare, ackHigh, activeStats, appointmentsToPrepare, checkInsToday, greeting, isTodayOrTomorrow,
  missedYesterdayCount, newToday, openHigh, openHighAlerts, progressSegments, scaleLabels, unresolvedMedium
} from './dashboard.metrics';

const LIMIT = 5;
const CLOSED = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const plotted = (r: PatientRow): boolean => r.painSeries.some(p => p.value !== null);

export type AttentionKind = 'critical' | 'review' | 'missing' | 'missed';

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  name: string;
  initials: string;
  patientId: number;
  /** Router link of the whole row: the patient, or the appointment for review / missing. */
  link: unknown[];
  sub: string;
  chip: ChipSpec;
  alert?: Alert;
  appt?: Appointment;
  phone?: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  protected now: () => Date = () => new Date();

  snapshot: CareSnapshot | null = null;
  /** CLINICAL_READ: alerts, check-ins and trends. Without it only the schedule is loaded. */
  clinical = false;
  receptionReady = false;
  metrics: AppointmentMetrics | null = null;
  today = businessToday();
  loading = true;
  errorMessage: string | null = null;
  actionError: string | null = null;
  live = '';
  firstName$: Observable<string>;
  codes: Record<number, string> = {};
  /** The clinic's configured name (Settings); the build-time name until it loads or when it fails. */
  clinicName = environment.clinicName;
  clinicName$: Observable<string>;
  overviewDay: 'today' | 'yesterday' = 'today';
  menuKey: string | null = null;
  showAll = false;
  chartPatientId: number | null = null;
  severityChip = severityChip;
  appointmentChip = appointmentChip;
  reviewChip: ChipSpec = { tone: 'serious', glyph: '◆', label: { key: 'enum.appointmentStatus.NEEDS_REVIEW' }, short: { key: 'chip.appt.reviewShort' } };
  missingChip: ChipSpec = { tone: 'warning', glyph: '●', label: { key: 'chip.appt.questionnaireMissing' }, short: { key: 'chip.appt.questionnaireMissingShort' } };
  missedChip: ChipSpec = { tone: 'warning', glyph: '●', label: { key: 'alert.missedCheckIn' }, short: { key: 'dashboard.chip.missedShort' } };
  atOrAboveChip: ChipSpec = { tone: 'critical', glyph: '▲', label: { key: 'dashboard.chip.atOrAbove' } };
  criticalChip: ChipSpec = { tone: 'critical', glyph: '▲', label: { key: 'dashboard.chip.critical' } };
  noneChip: ChipSpec = { tone: 'good', glyph: '✓', label: { key: 'dashboard.chip.noneOpen' } };

  // derived (see rebuild())
  kpi = { openHigh: 0, newToday: 0, ackHigh: 0, received: 0, expected: 0, missed: 0, prepare: { needsReview: 0, missing: 0, total: 0 } as ToPrepare };
  critical: Alert[] = [];
  reviews: Appointment[] = [];
  missing: Appointment[] = [];
  missedRows: PatientRow[] = [];
  mediumCount = 0;
  todayAppts: Appointment[] = [];
  trends: PatientRow[] = [];
  trendTotal = 0;
  limit = LIMIT;
  items: AttentionItem[] = [];
  stats: ActiveStats = { active: 0, stable: 0, critical: 0, expectedYesterday: 0, missedYesterday: 0 };
  progress: ProgressSegments = { expected: 0, received: 0, pending: 0, missed: 0, aPct: 0, abPct: 0 };
  scale: number[] = [0, 100];
  criticalRows: PatientRow[] = [];

  constructor(
    private care: CareDataService,
    private alerts: AlertService,
    private appointments: AppointmentService,
    private alertCount: AlertCountService,
    settings: SettingsService,
    auth: StaffAuth,
    private permissions: Permissions,
    private i18n: I18nService,
    private errors: ApiErrorsService
  ) {
    this.clinicName$ = settings.clinic$.pipe(map(c => c.name), catchError(() => of(environment.clinicName)));
    this.firstName$ = combineLatest([permissions.me$, auth.userName$]).pipe(map(([me, n]) => ((me?.displayName ?? n ?? '').trim().split(/\s+/)[0]) ?? ''));
  }

  ngOnInit(): void {
    this.clinical = this.permissions.can('CLINICAL_READ');
    this.reload();
  }

  get ready(): boolean {
    return this.clinical ? !!this.snapshot : this.receptionReady;
  }

  get greetingText(): string {
    return this.i18n.t(greeting(businessHour(this.now())));
  }

  get yesterday(): string {
    return addDays(this.today, -1);
  }

  get total(): number {
    return this.critical.length + this.reviews.length + this.missing.length + this.missedRows.length;
  }

  reload(): void {
    if (!this.clinical) {
      this.reloadSchedule();
      return;
    }
    this.care.load().subscribe({
      next: s => {
        this.snapshot = s;
        this.today = s.today;
        this.rebuild(s);
        this.loading = false;
        this.errorMessage = null;
      },
      error: () => {
        this.loading = false;
        this.snapshot = null; // never show "nothing needs attention" / "no appointments" on top of a failed load
        this.errorMessage = this.i18n.t('dashboard.error.load');
      }
    });
  }

  /** Reception: today's appointments and their metrics, nothing clinical. */
  private reloadSchedule(): void {
    const today = businessToday();
    this.today = today;
    const canRead = this.permissions.can('APPOINTMENT_READ');
    forkJoin({
      appts: canRead ? this.appointments.list(today, today) : of<Appointment[]>([]),
      metrics: canRead ? this.appointments.metrics(today, today) : of<AppointmentMetrics | null>(null)
    }).subscribe({
      next: r => {
        this.todayAppts = [...r.appts].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id);
        this.metrics = r.metrics;
        this.receptionReady = true;
        this.loading = false;
        this.errorMessage = null;
      },
      error: () => {
        this.loading = false;
        this.receptionReady = false;
        this.errorMessage = this.i18n.t('dashboard.error.load');
      }
    });
  }

  private rebuild(s: CareSnapshot): void {
    const t = s.today;
    this.kpi = {
      openHigh: openHigh(s.alerts), newToday: newToday(s.alerts, t), ackHigh: ackHigh(s.alerts),
      ...checkInsToday(s.rows), missed: missedYesterdayCount(s.rows), prepare: appointmentsToPrepare(s.appointments, t)
    };
    this.critical = openHighAlerts(s.alerts).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const soon = s.appointments.filter(a => isTodayOrTomorrow(a, t));
    const byTime = (a: Appointment, b: Appointment) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id;
    this.reviews = soon.filter(a => a.status === 'NEEDS_REVIEW').sort(byTime);
    this.missing = soon.filter(a => a.status === 'SCHEDULED' && a.questionnaireMissing).sort(byTime);
    this.missedRows = s.rows.filter(r => r.missedYesterday);
    this.mediumCount = unresolvedMedium(s.alerts);
    this.todayAppts = s.appointments.filter(a => a.scheduledAt.substring(0, 10) === t).sort(byTime);
    const active = s.rows.filter(r => r.followUp?.status === 'ACTIVE')
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.patient.lastName.localeCompare(b.patient.lastName));
    this.trendTotal = active.length;
    this.trends = active.slice(0, 6);
    this.stats = activeStats(s.rows, t);
    this.setOverview(this.overviewDay);
    // the chart card prefers a critical patient that has check-ins to show
    this.criticalRows = active.filter(r => r.status === 'CRITICAL')
      .sort((a, b) => Number(plotted(b)) - Number(plotted(a)));
    if (!this.criticalRows.some(r => r.patient.id === this.chartPatientId)) {
      this.chartPatientId = this.criticalRows.length ? this.criticalRows[0].patient.id! : null;
    }
    this.items = this.buildItems(s);
  }

  setOverview(day: 'today' | 'yesterday'): void {
    this.overviewDay = day;
    if (this.snapshot) {
      this.progress = progressSegments(this.snapshot.rows, day, this.snapshot.today);
      this.scale = scaleLabels(this.progress.aPct, this.progress.abPct);
    }
  }

  private buildItems(s: CareSnapshot): AttentionItem[] {
    const rowOf = (id: number) => s.rows.find(r => r.patient.id === id);
    const dayOf = (id: number) => {
      const d = rowOf(id)?.day;
      return d ? ` · ${this.i18n.t('common.dayOf', { day: d.day, total: d.total })}` : '';
    };
    const out: AttentionItem[] = [];
    for (const a of this.critical) {
      out.push({
        key: 'a' + a.id, kind: 'critical', name: this.nameOf(a), initials: this.initialsOf(a), patientId: a.patientId,
        link: ['/patients', a.patientId], sub: `${this.alertShort(a)}${dayOf(a.patientId)}`,
        chip: severityChip(a.severity), alert: a
      });
    }
    for (const a of this.reviews) {
      out.push({
        key: 'r' + a.id, kind: 'review', name: this.nameOf(a), initials: this.initialsOf(a), patientId: a.patientId,
        link: ['/appointments', a.id], sub: `${this.typeLabel(a)} · ${this.time(a)}${a.flagCount ? ' · ' + this.i18n.t('dashboard.flags', { count: a.flagCount }) : ''}`,
        chip: this.reviewChip, appt: a
      });
    }
    for (const a of this.missing) {
      out.push({
        key: 'm' + a.id, kind: 'missing', name: this.nameOf(a), initials: this.initialsOf(a), patientId: a.patientId,
        link: ['/appointments', a.id], sub: `${this.typeLabel(a)} · ${this.when(a)}`, chip: this.missingChip, appt: a
      });
    }
    for (const r of this.missedRows) {
      out.push({
        key: 'x' + r.patient.id, kind: 'missed', name: r.name, initials: r.initials, patientId: r.patient.id!,
        link: ['/patients', r.patient.id], sub: this.i18n.t('dashboard.noCheckIn', { date: this.shortDate(this.yesterday) }), chip: this.missedChip, phone: r.patient.phone
      });
    }
    return out;
  }

  /** "Pain 8" / "Temp 38.4 °C"; any other measure keeps its question label. */
  alertShort(a: Alert): string {
    if (a.type === 'MISSED_CHECKIN') {
      return a.missedDate ? this.i18n.t('dashboard.missedOn', { date: this.shortDate(a.missedDate) }) : this.i18n.t('alert.missedCheckIn');
    }
    const v = this.display(a);
    switch (a.linkId) {
      case 'PAIN': return this.i18n.t('dashboard.measure.pain', { value: v });
      case 'TEMPERATURE': return this.i18n.t('dashboard.measure.temp', { value: v });
      default: return this.i18n.t('dashboard.measure.other', { label: alertQuestion(a, this.i18n.lang, k => this.i18n.t(k)).text, value: v });
    }
  }

  get shown(): AttentionItem[] {
    return this.showAll ? this.items : this.items.slice(0, this.limit);
  }

  private shortDate(iso: string): string {
    return fmtDate(iso, 'dateShort', this.i18n.lang);
  }

  get chartRow(): PatientRow | null {
    return this.criticalRows.find(r => r.patient.id === this.chartPatientId) ?? null;
  }

  /** "Today" counts as missed only once the day is over, like the profile page. */
  chartToday(r: PatientRow): number | null {
    return r.followUp ? chartTodayDay(r.followUp, r.checkedInToday, this.today) : null;
  }

  /* ---------- row overflow menu ---------- */

  toggleMenu(key: string, e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    this.menuKey = this.menuKey === key ? null : key;
    if (this.menuKey) {
      const trigger = e.currentTarget as HTMLElement;
      setTimeout(() => (trigger.parentElement?.querySelector('[role=menuitem]') as HTMLElement | null)?.focus());
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuKey) {
      const el = document.querySelector<HTMLElement>(`[data-more="${this.menuKey}"]`);
      this.menuKey = null;
      el?.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.menuKey && !(e.target as HTMLElement).closest('.row-menu, .more-btn')) {
      this.menuKey = null;
    }
  }

  initialsOf(a: { patientFirstName: string; patientLastName: string }): string {
    return ((a.patientFirstName ?? '').trim().charAt(0) + (a.patientLastName ?? '').trim().charAt(0)).toUpperCase();
  }
  nameOf(a: { patientFirstName: string; patientLastName: string }): string {
    return `${a.patientFirstName} ${a.patientLastName}`;
  }

  display(a: Alert): string {
    return alertAnswer(a, this.i18n.lang, k => this.i18n.t(k));
  }

  when(a: Appointment): string {
    return `${fmtDate(a.scheduledAt.substring(0, 10), 'dayShort', this.i18n.lang)} ${fmtClock(a.scheduledAt.substring(11, 16), this.i18n.lang)}`;
  }

  time(a: Appointment): string {
    return fmtClock(a.scheduledAt.substring(11, 16), this.i18n.lang);
  }

  typeLabel(a: Appointment): string {
    return this.i18n.t(enumKey('appointmentType', a.type));
  }

  get criticalTitle(): string {
    return [this.i18n.t('dashboard.kpi.criticalNew', { count: this.kpi.newToday }), this.i18n.t('dashboard.kpi.criticalAck', { count: this.kpi.ackHigh })].join(' · ');
  }

  get prepareTitle(): string {
    return [this.i18n.t('dashboard.kpi.prepareReview', { count: this.kpi.prepare.needsReview }), this.i18n.t('dashboard.kpi.prepareMissing', { count: this.kpi.prepare.missing })].join(' · ');
  }

  get segAria(): string {
    const p = this.progress;
    const lang = this.i18n.lang;
    const base = this.i18n.t(this.overviewDay === 'today' ? 'dashboard.seg.ariaToday' : 'dashboard.seg.ariaYesterday', { received: p.received, expected: p.expected });
    const parts = [
      ...(p.pending ? [this.i18n.t('dashboard.seg.pending', { count: p.pending })] : []),
      ...(p.missed ? [this.i18n.t('dashboard.seg.missed', { count: p.missed })] : [])
    ];
    return parts.length ? `${base}, ${fmtList(parts, lang)}` : base;
  }

  isClosed(a: Appointment): boolean {
    return CLOSED.includes(a.status);
  }

  canRegenerate(a: Appointment): boolean {
    return a.scheduledAt > businessNow();
  }

  atOrAbove(r: PatientRow): boolean {
    return r.lastPain !== null && r.painThreshold !== null && r.lastPain >= r.painThreshold;
  }

  /* ---------- actions ---------- */

  acknowledge(a: Alert): void {
    this.actionError = null;
    this.alerts.acknowledge(a.id).subscribe({
      next: () => {
        this.critical = this.critical.filter(x => x.id !== a.id);
        this.items = this.items.filter(i => i.key !== 'a' + a.id);
        this.menuKey = null;
        this.live = this.i18n.t('dashboard.live.acknowledged');
        this.alertCount.refresh();
        this.reload();
      },
      error: err => this.failed(err, 'alert')
    });
  }

  markReviewed(a: Appointment): void {
    this.actionError = null;
    this.appointments.markReviewed(a.id).subscribe({
      next: () => {
        this.menuKey = null;
        this.live = this.i18n.t('dashboard.live.reviewed');
        this.reload();
      },
      error: err => this.failed(err, 'appointment')
    });
  }

  newLink(a: Appointment): void {
    if (!window.confirm(this.i18n.t('dashboard.confirmNewLink'))) {
      return;
    }
    this.actionError = null;
    this.appointments.regenerateCode(a.id).subscribe({
      next: res => {
        this.menuKey = null;
        this.codes = { ...this.codes, [a.id]: res.accessCode };
      },
      error: err => this.failed(err, 'appointment')
    });
  }

  private failed(err: { status?: number }, what: 'alert' | 'appointment'): void {
    this.menuKey = null;
    if (err?.status === 409) {
      this.actionError = this.i18n.t(what === 'alert' ? 'dashboard.error.alertConflict' : 'dashboard.error.apptConflict');
      this.reload();
    } else {
      this.actionError = this.errors.text(err, 'dashboard.error.update');
    }
  }
}
