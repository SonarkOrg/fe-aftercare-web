import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AlertService } from '../../Services/Alert.service';
import { AppointmentService } from '../../Services/Appointment.service';
import { FollowUpService } from '../../Services/FollowUp.service';
import { MessageService } from '../../Services/Message.service';
import { PatientService } from '../../Services/Patient.service';
import { PatientFileService } from '../../Services/PatientFile.service';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { FhirQuestionnaire } from '../../fhir/fhir.model';
import { answerOf } from '../../fhir/fhir.util';
import { Alert } from '../../models/alert.model';
import { Appointment } from '../../models/appointment.model';
import { CheckIn, FollowUp, FollowUpWithCode } from '../../models/follow-up.model';
import { CareTeamMember, PatientMedical } from '../../models/medical.model';
import { Patient } from '../../models/patient.model';
import { QuestionnaireDefinitionDetail } from '../../models/questionnaire-definition.model';
import { SeriesPoint } from '../../shared/care.model';
import { ageOn } from '../../shared/age.util';
import { businessNow, businessToday, humanize, relativeDay } from '../../shared/link.util';
import {
  PAIN_LINK, TEMPERATURE_LINK, alertThreshold, buildSeries, chartTodayDay, computeStatus, followUpDay
} from '../../shared/patient-status';
import { ChipSpec, appointmentChip, patientStatusChip, severityChip, staffActiveChip } from '../../shared/status';
import { fmtDayYear } from '../../shared/messages.util';
import { ThresholdState } from '../../shared/trend-chart/trend-chart.component';
import { PageTitleService } from '../../shell/page-title.service';

export type ProfileTab = 'overview' | 'medical' | 'contacts' | 'timeline' | 'documents' | 'messages' | 'checkins' | 'alerts' | 'appointments' | 'audit';
const TABS: ProfileTab[] = ['overview', 'medical', 'contacts', 'timeline', 'documents', 'messages', 'checkins', 'alerts', 'appointments', 'audit'];

export interface ChartSpec { linkId: string; label: string; unit: string; domain: [number, number] | 'auto'; points: SeriesPoint[]; threshold: number | null }

@Component({
  selector: 'app-patient-detail',
  templateUrl: './patient-detail.component.html'
})
export class PatientDetailComponent implements OnInit {
  patientId = 0;
  patient: Patient | null = null;
  followUps: FollowUp[] = [];
  checkIns: CheckIn[] = [];
  alerts: Alert[] = [];
  appointments: Appointment[] = [];
  loading = true;
  notFound = false;
  errorMessage: string | null = null;
  actionError: string | null = null;
  accessCode: string | null = null;
  expanded = new Set<number>();
  defs: Record<number, FhirQuestionnaire> = {};
  humanize = humanize;
  relativeDay = relativeDay;
  severityChip = severityChip;
  inactiveChip = staffActiveChip(false);
  appointmentChip = appointmentChip;
  /** Whether the alert thresholds behind the charts loaded, are loading, or failed. */
  thresholdState: ThresholdState = 'loading';
  today = businessToday();
  tabs = TABS;
  tab: ProfileTab = 'overview';
  /** Tabs opened at least once: their content is created on first open and kept (hidden) afterwards. */
  visited = new Set<ProfileTab>(['overview']);
  medical: PatientMedical | null = null;
  medicalError = false;
  careTeam: CareTeamMember[] = [];
  unreadMessages = 0;
  def: QuestionnaireDefinitionDetail | null = null;
  charts: ChartSpec[] = [];
  chartTotal = 7;
  chartToday: number | null = null;
  painThreshold: number | null = null;

  @ViewChildren('tabBtn') tabButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  constructor(
    private route: ActivatedRoute,
    private patients: PatientService,
    private followUpService: FollowUpService,
    private alertService: AlertService,
    private appointmentService: AppointmentService,
    private definitions: QuestionnaireDefinitionService,
    private files: PatientFileService,
    private messages: MessageService,
    private router: Router,
    private titles: PageTitleService
  ) {}

  ngOnInit(): void {
    this.patientId = Number(this.route.snapshot.paramMap.get('id'));
    const t = this.route.snapshot.queryParamMap?.get('tab') as ProfileTab | null;
    if (t && TABS.includes(t)) {
      this.tab = t;
      this.visited.add(t);
    }
    this.reload();
    this.loadFile();
  }

  /** Medical summary (writes the "file viewed" audit row, so once per visit, not on reload), care team and unread messages. */
  loadFile(): void {
    this.medicalError = false;
    this.files.medical(this.patientId).subscribe({
      next: m => (this.medical = m),
      error: () => (this.medicalError = true)
    });
    this.files.careTeam(this.patientId).subscribe({ next: c => (this.careTeam = c), error: () => { /* the card shows its empty state */ } });
    // the inbox carries the unread count: opening the thread here would write a "messages viewed" audit row
    const pid = this.patientId;
    this.messages.inbox().subscribe({
      next: list => (this.unreadMessages = list.find(c => c.patientId === pid)?.unreadCount ?? 0),
      error: () => { /* no count on the tab */ }
    });
  }

  /* ---------- hero ---------- */

  get age(): number | null {
    return ageOn(this.medical?.dateOfBirth ?? this.patient?.dateOfBirth, this.today);
  }

  get dob(): string | null {
    return this.medical?.dateOfBirth ?? this.patient?.dateOfBirth ?? null;
  }

  dobLabel(d: string): string {
    return fmtDayYear(d + 'T12:00:00Z');
  }

  /** Allergy chip in the hero: severe ones by name, otherwise a count; nothing when none are recorded. */
  get allergyChip(): { spec: ChipSpec; title: string } | null {
    const all = this.medical?.allergies ?? [];
    if (!all.length) {
      return null;
    }
    const severe = all.filter(a => a.severity === 'SEVERE');
    const title = all.map(a => a.substance).join(', ');
    if (severe.length === 1) {
      return { spec: { tone: 'critical', glyph: '▲', label: `Allergy: ${severe[0].substance}` }, title };
    }
    if (severe.length > 1) {
      return { spec: { tone: 'critical', glyph: '▲', label: `Allergies: ${severe.length}` }, title };
    }
    return { spec: { tone: 'warning', glyph: '●', label: `Allergies: ${all.length}` }, title };
  }

  tabCount(t: ProfileTab): number {
    switch (t) {
      case 'messages': return this.unreadMessages;
      case 'checkins': return this.checkIns.length;
      case 'alerts': return this.unresolved.length;
      case 'appointments': return this.appointments.length;
      default: return 0;
    }
  }

  initialsOf(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  }

  tabLabel(t: ProfileTab): string {
    return t === 'checkins' ? 'Check-ins' : t === 'audit' ? 'Access log' : t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* ---------- derived data ---------- */

  /** The follow-up the charts describe: the current one, else the most recent. */
  get chartFollowUp(): FollowUp | undefined {
    return this.current ?? [...this.followUps].sort((a, b) => b.dischargeDate.localeCompare(a.dischargeDate) || b.id - a.id)[0];
  }

  get currentCheckIns(): CheckIn[] {
    const f = this.current;
    return f ? this.checkIns.filter(c => c.followUpId === f.id) : [];
  }

  get unresolved(): Alert[] {
    return this.alerts.filter(a => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED');
  }

  get openHigh(): number {
    return this.alerts.filter(a => a.status === 'OPEN' && a.severity === 'HIGH').length;
  }

  get statusChip(): ChipSpec {
    return patientStatusChip(computeStatus({ followUp: this.current, alerts: this.alerts, checkIns: this.currentCheckIns, today: this.today }).status);
  }

  get day() {
    return followUpDay(this.current, this.today);
  }

  get lastCheckInDate(): string | null {
    return this.checkIns.reduce<string | null>((m, c) => (m === null || c.checkInDate > m ? c.checkInDate : m), null);
  }

  get nextAppointment(): Appointment | null {
    const now = businessNow();
    return this.appointments
      .filter(a => ['SCHEDULED', 'READY', 'NEEDS_REVIEW'].includes(a.status) && a.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null;
  }

  get recentAlerts(): Alert[] {
    return this.unresolved.slice(0, 3);
  }

  get checkInCount(): number {
    return this.checkIns.length;
  }

  private recomputeCharts(): void {
    const f = this.chartFollowUp;
    this.charts = [];
    if (!f) {
      return;
    }
    const rules = this.def?.rules ?? [];
    const items = new Set((this.def?.questionnaire.item ?? []).map(i => i.linkId));
    const mine = this.checkIns.filter(c => c.followUpId === f.id);
    const specs: ChartSpec[] = [];
    if (!this.def || items.has(PAIN_LINK)) {
      specs.push({ linkId: PAIN_LINK, label: 'Pain (0–10)', unit: '', domain: [0, 10], points: buildSeries(f, mine, PAIN_LINK), threshold: alertThreshold(rules, PAIN_LINK) });
    }
    if (this.def && items.has(TEMPERATURE_LINK)) {
      specs.push({ linkId: TEMPERATURE_LINK, label: 'Temperature (°C)', unit: '°C', domain: 'auto', points: buildSeries(f, mine, TEMPERATURE_LINK), threshold: alertThreshold(rules, TEMPERATURE_LINK) });
    }
    this.charts = specs;
    this.painThreshold = alertThreshold(rules, PAIN_LINK);
    this.chartTotal = f.durationDays;
    this.chartToday = chartTodayDay(f, mine.some(c => c.checkInDate === this.today), this.today);
  }

  numeric(c: CheckIn, linkId: string): number | null {
    const v = answerOf(c.response, linkId);
    return typeof v === 'number' ? v : null;
  }

  painAlert(c: CheckIn): boolean {
    const v = this.numeric(c, PAIN_LINK);
    return v !== null && this.painThreshold !== null && v >= this.painThreshold;
  }

  /* ---------- tabs ---------- */

  selectTab(t: ProfileTab, focus = false): void {
    this.tab = t;
    this.visited.add(t);
    this.router.navigate([], { queryParams: { tab: t === 'overview' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true });
    if (focus) {
      setTimeout(() => this.tabButtons?.get(TABS.indexOf(t))?.nativeElement.focus());
    }
  }

  onTabKey(e: KeyboardEvent): void {
    const i = TABS.indexOf(this.tab);
    let next = -1;
    switch (e.key) {
      case 'ArrowRight': next = (i + 1) % TABS.length; break;
      case 'ArrowLeft': next = (i + TABS.length - 1) % TABS.length; break;
      case 'Home': next = 0; break;
      case 'End': next = TABS.length - 1; break;
    }
    if (next >= 0) {
      e.preventDefault();
      this.selectTab(TABS[next], true);
    }
  }

  get current(): FollowUp | undefined {
    return this.followUps.find(f => f.status !== 'CLOSED');
  }

  get canEnroll(): boolean {
    const c = this.current;
    return !c || c.status === 'EXPIRED';
  }

  reload(): void {
    forkJoin({
      patient: this.patients.getPatient(this.patientId),
      followUps: this.followUpService.listForPatient(this.patientId),
      checkIns: this.followUpService.checkInsForPatient(this.patientId),
      alerts: this.alertService.listForPatient(this.patientId),
      appointments: this.appointmentService.listForPatient(this.patientId)
    }).subscribe({
      next: r => {
        this.patient = r.patient;
        this.followUps = r.followUps;
        this.checkIns = r.checkIns;
        this.alerts = r.alerts;
        this.appointments = r.appointments;
        this.loading = false;
        this.titles.set(`${r.patient.firstName} ${r.patient.lastName}`);
        this.recomputeCharts();
        this.loadDefinition();
      },
      error: err => {
        this.loading = false;
        if (err?.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = 'Could not load patient.';
        }
      }
    });
  }

  private loadDefinition(): void {
    const f = this.chartFollowUp;
    if (!f) {
      this.def = null;
      this.thresholdState = 'known';
      return;
    }
    this.thresholdState = 'loading';
    this.definitions.get(f.questionnaireDefinitionId).subscribe({
      next: d => {
        this.def = d;
        this.thresholdState = 'known';
        this.recomputeCharts();
      },
      error: () => {
        this.thresholdState = 'failed'; // charts render without thresholds and say so
        console.warn('Could not load the form definition; charts are shown without alert thresholds.');
      }
    });
  }

  onEnrolled(res: FollowUpWithCode): void {
    this.accessCode = res.accessCode;
    this.reload();
  }

  regenerate(f: FollowUp): void {
    if (!window.confirm('The previous link will stop working. Continue?')) {
      return;
    }
    this.actionError = null;
    this.followUpService.regenerateCode(f.id).subscribe({
      next: res => {
        this.accessCode = res.accessCode;
        this.reload();
      },
      error: () => (this.actionError = 'Could not regenerate the link.')
    });
  }

  close(f: FollowUp): void {
    if (!window.confirm('Close this follow-up? The patient link will stop working.')) {
      return;
    }
    this.actionError = null;
    this.followUpService.close(f.id).subscribe({
      next: () => {
        this.accessCode = null;
        this.reload();
      },
      error: () => (this.actionError = 'Could not close the follow-up.')
    });
  }

  toggle(c: CheckIn): void {
    if (this.expanded.has(c.id)) {
      this.expanded.delete(c.id);
      return;
    }
    this.expanded.add(c.id);
    const defId = c.questionnaireDefinitionId;
    if (!this.defs[defId]) {
      this.definitions.get(defId).subscribe({
        next: d => (this.defs[defId] = d.questionnaire),
        error: () => (this.actionError = 'Could not load the form definition.')
      });
    }
  }

  date(a: Appointment): string {
    return a.scheduledAt.substring(0, 10);
  }

  time(a: Appointment): string {
    return a.scheduledAt.substring(11, 16);
  }
}
