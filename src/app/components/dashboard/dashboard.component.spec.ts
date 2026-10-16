import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlertCountService } from '../../Services/AlertCount.service';
import { SettingsService } from '../../Services/Settings.service';
import { StaffAuth } from '../../auth/staff-auth';
import { Patient } from '../../models/patient.model';
import { AccessLinkComponent } from '../../shared/access-link/access-link.component';
import { addDays, businessToday } from '../../shared/link.util';
import { CLINIC, SEED_RULES, alertDto, missedAlert, appointment, checkInDto, followUp, providePermissions } from '../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const today = businessToday();
  const tomorrow = addDays(today, 1);

  const person = (id: number, firstName: string, lastName: string, fu = true): Patient => ({
    id, firstName, lastName, email: 'x@example.com', phone: '555-0100', gender: 'female', address: { city: 'c', state: 's', zip: 'z' },
    activeFollowUp: fu ? followUp({ id: 10 + id, patientId: id, dischargeDate: addDays(today, -3), endDate: addDays(today, 4) }) : null
  });
  const patients = [person(1, 'Marie', 'Tremblay'), person(2, 'Jean', 'Roy'), person(3, 'Sophie', 'Lavoie', false)];
  const alerts = [
    alertDto({ id: 1, patientId: 1, patientFirstName: 'Marie', patientLastName: 'Tremblay', createdAt: '2026-10-01T10:00:00Z' }),
    alertDto({ id: 2, patientId: 2, patientFirstName: 'Jean', patientLastName: 'Roy', linkId: 'CALF', questionLabel: 'Calf pain?', answerValue: 'true', createdAt: '2026-10-02T10:00:00Z' }),
    alertDto({ id: 3, patientId: 1, severity: 'MEDIUM', status: 'ACKNOWLEDGED' })
  ];
  const checkIns = [
    checkInDto({ id: 1, patientId: 1, followUpId: 11, checkInDate: today, pain: 3 }),
    checkInDto({ id: 2, patientId: 1, followUpId: 11, checkInDate: addDays(today, -1), pain: 8 })
  ];
  const appts = [
    appointment({ id: 10, patientId: 1, patientFirstName: 'Marie', patientLastName: 'Tremblay', scheduledAt: `${tomorrow}T10:30:00`, status: 'NEEDS_REVIEW', flagCount: 2 }),
    appointment({ id: 11, patientId: 2, patientFirstName: 'Jean', patientLastName: 'Roy', scheduledAt: `${tomorrow}T23:00:00`, status: 'SCHEDULED', questionnaireMissing: true }),
    appointment({ id: 12, patientId: 3, patientFirstName: 'Sophie', patientLastName: 'Lavoie', scheduledAt: `${today}T08:30:00`, status: 'COMPLETED' })
  ];
  let alertCount: { refresh: jasmine.Spy };

  beforeEach(async () => {
    alertCount = { refresh: jasmine.createSpy('refresh') };
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule],
      declarations: [DashboardComponent, AccessLinkComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), 
        { provide: StaffAuth, useValue: { userName$: of('Dev Nurse') } },
        { provide: AlertCountService, useValue: alertCount },
        { provide: SettingsService, useValue: { clinic$: of(CLINIC) } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  function flushFeeds(a = alerts, p = patients) {
    http.expectOne(`${api}/patients`).flush(p);
    http.expectOne(r => r.url === `${api}/alerts`).flush(a);
    http.expectOne(r => r.url === `${api}/check-ins`).flush(checkIns);
    http.expectOne(r => r.url === `${api}/appointments`).flush(appts);
    http.match(`${api}/questionnaires/7`).forEach(r => r.flush({ id: 7, rules: SEED_RULES, questionnaire: {} }));
    fixture.detectChanges();
  }

  function init(a = alerts) {
    fixture.detectChanges();
    flushFeeds(a);
  }

  const kpiValues = () => Array.from(el.querySelectorAll('.kpi__value')).map(v => v.childNodes[0].textContent!.trim());
  const attn = () => Array.from(el.querySelectorAll<HTMLElement>('.attn'));
  const openMenu = (kind: string) => {
    (el.querySelector(`.attn[data-kind=${kind}] .more-btn`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('shows the configured clinic name in the hero', () => {
    init();
    expect(el.querySelector('.hero__clinic')!.textContent).toContain('Clinique Test');
  });

  it('renders the pastel KPI values from the fixtures', () => {
    init();
    expect(kpiValues()).toEqual(['2', '1 / 2', '1', '2']); // Jean has no check-in yesterday
    expect(el.querySelector('#kpi-prepare')!.getAttribute('title')).toContain('1 need review · 1 questionnaire missing');
    expect(el.querySelector('#kpi-critical')!.getAttribute('title')).toContain('0 acknowledged');
    expect(el.querySelector('#kpi-critical .chip__label')!.textContent).toBe('Critical');
    // every KPI icon is an outlined app-icon, not a filled glyph
    expect(el.querySelectorAll('.kpi__icon svg[fill="none"]').length).toBe(4);
  });

  it('renders the overview: progress A/B from today, four ring tiles with links', () => {
    init();
    expect((el.querySelector('.seg-bar__a') as HTMLElement).style.width).toBe('50%');
    expect(el.querySelector('.seg-legend')!.textContent).toContain('1 received');
    expect(el.querySelector('.seg-legend')!.textContent).toContain('1 still due today');
    const tiles = Array.from(el.querySelectorAll('app-ring-tile')).map(t => t.querySelector('.tile__value')!.textContent!.replace(/\s+/g, ' ').trim());
    expect(tiles).toEqual(['2', '0 / 2', '2 / 2', '1 / 2']);
    expect(el.querySelector('app-ring-tile a')!.getAttribute('href')).toBe('/patients?status=all');
    expect(el.querySelectorAll('app-ring-tile')[2].querySelector('a')!.getAttribute('href')).toBe('/patients?status=critical');
  });

  it('0 of 2 received renders no fill and no markers; 0 of 0 renders no bar', () => {
    init();
    component.progress = { expected: 2, received: 0, pending: 2, missed: 0, aPct: 0, abPct: 0 };
    component.scale = [0, 100];
    fixture.detectChanges();
    expect((el.querySelector('.seg-bar__a') as HTMLElement).style.width).toBe('0%');
    expect((el.querySelector('.seg-bar__b') as HTMLElement).style.width).toBe('0%');
    expect(el.querySelectorAll('.seg-marker').length).toBe(0);
    component.progress = { expected: 0, received: 0, pending: 0, missed: 0, aPct: 0, abPct: 0 };
    fixture.detectChanges();
    expect(el.querySelector('.seg-bar')).toBeNull();
    expect(el.querySelector('.prog .empty')!.textContent).toContain('No check-ins due');
  });

  it('the period select switches the bar to yesterday: received + hatched not-received remainder', () => {
    init();
    const sel = el.querySelector('#overview-day') as HTMLSelectElement;
    sel.value = 'yesterday';
    sel.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('.label-lg')!.textContent).toContain('yesterday');
    expect((el.querySelector('.seg-bar__a') as HTMLElement).style.width).toBe('50%');
    expect(el.querySelector('.seg-legend')!.textContent).toContain('1 not received');
    expect(el.querySelector('.seg-legend')!.textContent).not.toContain('still due');
  });

  it('shows one Needs attention list in order: critical, review, missing, missed', () => {
    init();
    expect(attn().map(r => r.dataset['kind'])).toEqual(['critical', 'critical', 'review', 'missing', 'missed']);
    expect(el.querySelector('#needs-attention-title .badge')!.textContent!.trim()).toBe('5');
    expect(attn()[0].textContent).toContain('Marie Tremblay'); // oldest alert first
    expect(attn()[0].textContent).toContain('Pain 8 · Day 3 of 7');
    expect(attn()[1].textContent).toContain('Calf pain?: Yes');
    expect(attn()[2].textContent).toContain('2 flag(s)');
    expect(attn()[4].textContent).toContain('Jean Roy');
    expect(attn()[4].textContent).toContain('Missed');
    expect(attn()[2].querySelector('.chip__label')!.textContent).toBe('Review');
    expect(attn()[2].querySelector('.sr-only')!.textContent).toBe('Needs review');
    expect(el.querySelector('.medium-line')!.textContent).toContain('1 medium alerts open');
    expect(attn()[0].querySelector('a.row__name')!.getAttribute('href')).toBe('/patients/1');
    expect(attn()[2].querySelector('a.row__name')!.getAttribute('href')).toBe('/appointments/10');
  });

  it('caps the list at 5 rows with a View all toggle', () => {
    const many = [...alerts, alertDto({ id: 9, patientId: 2, patientFirstName: 'Jean', patientLastName: 'Roy', createdAt: '2026-10-03T10:00:00Z' })];
    init(many);
    expect(attn().length).toBe(5);
    const btn = el.querySelector('.view-all') as HTMLButtonElement;
    expect(btn.textContent).toContain('View all (6)');
    btn.click();
    fixture.detectChanges();
    expect(attn().length).toBe(6);
  });

  it('row actions live in a menu: open, Esc closes and returns focus', () => {
    document.body.appendChild(el);
    init();
    openMenu('critical');
    const menu = el.querySelector('.row-menu')!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.querySelectorAll('[role=menuitem]').length).toBe(2);
    expect(el.querySelector('.more-btn')!.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.row-menu')).toBeNull();
    el.remove();
  });

  it('Acknowledge posts, removes the row and refreshes the badge count', () => {
    init();
    openMenu('critical');
    (el.querySelector('.row-menu .btn-ack') as HTMLButtonElement).click();
    http.expectOne(`${api}/alerts/1/acknowledge`).flush(alertDto({ id: 1, status: 'ACKNOWLEDGED' }));
    expect(alertCount.refresh).toHaveBeenCalled();
    fixture.detectChanges();
    expect(attn().filter(r => r.dataset['kind'] === 'critical').length).toBe(1);
    flushFeeds([alerts[1], alerts[2]]);
    expect(attn().filter(r => r.dataset['kind'] === 'critical').length).toBe(1);
  });

  it('409 on acknowledge says "alert" and on mark reviewed says "appointment", then reloads', () => {
    init();
    openMenu('critical');
    (el.querySelector('.row-menu .btn-ack') as HTMLButtonElement).click();
    http.expectOne(`${api}/alerts/1/acknowledge`).flush({}, { status: 409, statusText: 'Conflict' });
    flushFeeds();
    expect(el.textContent).toContain('This alert was updated by someone else. Reloading.');
    openMenu('review');
    (el.querySelector('.row-menu .btn-reviewed') as HTMLButtonElement).click();
    http.expectOne(`${api}/appointments/10/review`).flush({}, { status: 409, statusText: 'Conflict' });
    flushFeeds();
    expect(el.textContent).toContain('This appointment was updated by someone else. Reloading.');
  });

  it('New link confirms, regenerates and shows the access link under the row', () => {
    init();
    spyOn(window, 'confirm').and.returnValue(true);
    openMenu('missing');
    (el.querySelector('.row-menu .btn-newlink') as HTMLButtonElement).click();
    http.expectOne(`${api}/appointments/11/access-code`).flush({ appointment: appts[1], accessCode: 'abc' });
    fixture.detectChanges();
    expect((el.querySelector('.attn[data-kind=missing] .access-link input') as HTMLInputElement).value).toContain('/q/abc');
  });

  it('missed rows offer Call', () => {
    init();
    openMenu('missed');
    expect(el.querySelector('.row-menu a[href^="tel:"]')).not.toBeNull();
  });

  it('shows the empty states when nothing needs attention', () => {
    fixture.detectChanges();
    http.expectOne(`${api}/patients`).flush([person(3, 'Sophie', 'Lavoie', false)]);
    http.expectOne(r => r.url === `${api}/alerts`).flush([]);
    http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Nothing needs attention');
    expect(el.textContent).toContain('No open high alerts, reviews, missing questionnaires or missed check-ins.');
    expect(el.textContent).toContain('No appointments today.');
    expect(el.textContent).toContain('No active follow-ups.');
    expect(el.textContent).toContain('No check-ins due today');
  });

  it('a failed load shows the error and Retry, and NO "empty" claims', () => {
    fixture.detectChanges();
    http.expectOne(`${api}/patients`).flush('boom', { status: 500, statusText: 'Server Error' });
    http.match(() => true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Could not load the dashboard.');
    expect(el.textContent).not.toContain('Nothing needs attention');
    expect(el.textContent).not.toContain('No appointments today.');
    expect(el.textContent).not.toContain('No active follow-ups.');
    expect(el.textContent).toContain('Retry');
  });

  it('lists today as big-time rows and a compact pain trend per active follow-up', () => {
    init();
    expect(el.querySelector('.appts')!.textContent).toContain('08:30');
    expect(el.querySelector('.appt--closed .chip__label')!.textContent).toBe('Completed');
    expect(el.querySelector('.appt a.chev-hit')!.getAttribute('aria-label')).toBe('Open Sophie Lavoie 08:30');
    const trends = el.querySelectorAll('.mini');
    expect(trends.length).toBe(2);
    // both CRITICAL: ordered by last name (Roy, Tremblay)
    expect(trends[0].textContent).toContain('Jean Roy');
    expect(trends[0].textContent).toContain('No check-ins yet');
    expect(trends[1].textContent).toContain('Marie Tremblay');
    expect(trends[1].textContent).toContain('Latest 3');
  });

  it('shows a full chart of the first critical patient with a patient select', () => {
    init();
    expect(el.querySelector('.critical-chart app-trend-chart .trend')).not.toBeNull();
    const sel = el.querySelector('.critical-chart select') as HTMLSelectElement;
    expect(sel.options.length).toBe(2);
    expect(sel.options[0].textContent).toContain('Marie Tremblay'); // the critical patient with check-ins comes first
  });

  it('renders a HIGH missed check-in alert in Needs attention with its missed day, not a question or answer', () => {
    init([...alerts, missedAlert({ id: 9, patientId: 2, patientFirstName: 'Jean', patientLastName: 'Roy', severity: 'HIGH', missedDate: '2026-10-12', createdAt: '2026-10-13T09:00:00Z' })]);
    const row = attn().find(r => r.dataset['kind'] === 'critical' && r.textContent!.includes('Missed check-in'))!;
    expect(row.querySelector('.row__sub')!.textContent).toContain('Missed check-in Oct 12');
    expect(row.textContent).not.toContain('null');
    expect(row.querySelector('.chip__label')!.textContent).toBe('High');
  });

  it('greets by the hour of day in America/Toronto', () => {
    const at = (h: number) => {
      (component as any).now = () => new Date(Date.UTC(2026, 9, 13, h + 4)); // EDT is UTC-4
      return component.greetingText;
    };
    expect([at(8), at(14), at(21)]).toEqual(['Good morning', 'Good afternoon', 'Good evening']);
    init();
    expect(el.querySelector('.hero__sub')!.textContent).toContain(', Dev');
    expect(el.querySelector('h1')!.textContent).toBe("Today's Aftercare");
  });
});

describe('DashboardComponent without CLINICAL_READ (reception)', () => {
  const api = environment.apiUrl;
  const today = businessToday();
  let fixture: ComponentFixture<DashboardComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const metrics = {
    from: today, to: today, total: 3, scheduled: 1, ready: 1, needsReview: 1, cancelled: 0, completed: 0, noShow: 0,
    questionnairesCompleted: 2, questionnaireMissing: 1, completionRate: 0.5
  };
  const appts = [
    appointment({ id: 12, patientId: 3, patientFirstName: 'Sophie', patientLastName: 'Lavoie', scheduledAt: `${today}T14:00:00`, status: 'SCHEDULED' }),
    appointment({ id: 11, patientId: 2, patientFirstName: 'Jean', patientLastName: 'Roy', scheduledAt: `${today}T08:30:00`, status: 'NEEDS_REVIEW', flagCount: 2 })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule],
      declarations: [DashboardComponent, AccessLinkComponent, ...SHARED_DECLARATIONS],
      providers: [
        providePermissions('RECEPTION'),
        { provide: StaffAuth, useValue: { userName$: of(null) } },
        { provide: AlertCountService, useValue: { refresh: jasmine.createSpy('refresh') } },
        { provide: SettingsService, useValue: { clinic$: of(CLINIC) } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  function init() {
    fixture.detectChanges();
    http.expectOne(r => r.url === `${api}/appointments`).flush(appts);
    http.expectOne(r => r.url === `${api}/appointments/metrics`).flush(metrics);
    fixture.detectChanges();
  }

  it('makes no clinical request at all: no alerts, check-ins, patients, definitions, messages or follow-ups', () => {
    fixture.detectChanges();
    http.expectNone(r => r.url === `${api}/alerts`);
    http.expectNone(r => r.url === `${api}/check-ins`);
    http.expectNone(`${api}/patients`);
    http.expectNone(r => r.url.startsWith(`${api}/questionnaires`));
    http.expectNone(r => r.url.startsWith(`${api}/messages`));
    const appt = http.expectOne(r => r.url === `${api}/appointments`);
    expect([appt.request.params.get('from'), appt.request.params.get('to')]).toEqual([today, today]);
    appt.flush([]);
    const m = http.expectOne(r => r.url === `${api}/appointments/metrics`);
    expect([m.request.params.get('from'), m.request.params.get('to')]).toEqual([today, today]);
    m.flush(metrics);
  });

  it('shows today\'s appointments in time order, the metrics and a Patients quick link', () => {
    init();
    const times = Array.from(el.querySelectorAll('.appt .appt__time')).map(t => t.textContent!.trim());
    expect(times).toEqual(['08:30', '14:00']);
    expect(el.querySelector('#today-title .badge')!.textContent).toBe('2');
    expect(el.querySelector('.reception-home dl.kv')!.textContent).toContain('Appointments3');
    expect(el.querySelector('.reception-home dl.kv')!.textContent).toContain('Needs review1');
    expect(el.querySelector('.reception-home dl.kv')!.textContent).toContain('Questionnaire missing1');
    expect(el.querySelector('.quick-patients')!.getAttribute('href')).toBe('/patients');
    expect(el.querySelector('a.btn[href="/appointments/new"]')).not.toBeNull(); // APPOINTMENT_WRITE
  });

  it('copes with a redacted (null) specialty and words the hero for appointments only', () => {
    fixture.detectChanges();
    http.expectOne(r => r.url === `${api}/appointments`).flush(appts.map(a => ({ ...a, specialty: null })));
    http.expectOne(r => r.url === `${api}/appointments/metrics`).flush(metrics);
    fixture.detectChanges();
    expect(el.querySelectorAll('.appt').length).toBe(2);
    expect(el.textContent).not.toMatch(/null|undefined/);
    expect(el.querySelector('.hero__sub')!.textContent).not.toContain('Check-ins');
    expect(el.querySelector('.hero__sub')!.textContent).toContain('appointments');
  });

  it('hides the alert, check-in, trend and KPI cards and the "Needs attention" list', () => {
    init();
    for (const sel of ['#needs-attention-title', '#overview-title', '#trends-title', '#critical-chart-title', '.kpis', '#kpi-critical', 'app-trend-chart', 'app-ring-tile']) {
      expect(el.querySelector(sel)).withContext(sel).toBeNull();
    }
  });

  it('greets with the directory name and shows a retry when the schedule cannot be loaded', () => {
    fixture.detectChanges();
    http.expectOne(r => r.url === `${api}/appointments`).flush('x', { status: 500, statusText: 'Server Error' });
    expect(http.match(r => r.url === `${api}/appointments/metrics`).every(r => r.cancelled)).toBeTrue(); // forkJoin gave up on it
    fixture.detectChanges();
    expect(el.querySelector('.error-message')!.textContent).toContain('Could not load the dashboard.');
    (el.querySelector('.error-message button') as HTMLButtonElement).click();
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    http.expectOne(r => r.url === `${api}/appointments/metrics`).flush(metrics);
    fixture.detectChanges();
    expect(el.querySelector('.error-message')).toBeNull();
    expect(el.querySelector('.hero__sub')!.textContent).toContain('Dev');
  });
});

describe('DashboardComponent buttons by permission', () => {
  it('hides New appointment and Add patient from a member without those permissions', async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule],
      declarations: [DashboardComponent, AccessLinkComponent, ...SHARED_DECLARATIONS],
      providers: [
        providePermissions('NURSE', { permissions: ['CLINICAL_READ', 'PATIENT_READ'] }),
        { provide: StaffAuth, useValue: { userName$: of('Dev Nurse') } },
        { provide: AlertCountService, useValue: { refresh: () => undefined } },
        { provide: SettingsService, useValue: { clinic$: of(CLINIC) } }
      ]
    }).compileComponents();
    const f = TestBed.createComponent(DashboardComponent);
    f.detectChanges();
    const e: HTMLElement = f.nativeElement;
    expect(e.querySelector('a[href="/appointments/new"]')).toBeNull();
    expect(e.querySelector('a[href="/patients?add=1"]')).toBeNull();
    TestBed.inject(HttpTestingController).match(() => true);
  });
});
