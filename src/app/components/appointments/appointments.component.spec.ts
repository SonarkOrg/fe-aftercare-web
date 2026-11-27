import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, Routes } from '@angular/router';
import { Permission } from '../../models/me.model';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AppointmentMetrics } from '../../models/appointment.model';
import { addDays, businessToday, mondayOf } from '../../shared/link.util';
import { appointment, arrivalRow, providePermissions } from '../../testing/fixtures';
import { AppointmentsComponent, VIEW_STORAGE_KEY } from './appointments.component';
import { APPOINTMENTS_ROUTES } from './appointments-pages.module';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

@Component({ template: '' })
class BlankComponent {}

describe('AppointmentsComponent', () => {
  let fixture: ComponentFixture<AppointmentsComponent>;
  let component: AppointmentsComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = `${environment.apiUrl}/appointments`;

  const metrics = (over: Partial<AppointmentMetrics> = {}): AppointmentMetrics => ({
    from: '2026-10-14', to: '2026-10-14', total: 3, scheduled: 1, ready: 1, needsReview: 1, cancelled: 1, completed: 0,
    noShow: 1, questionnairesCompleted: 2, questionnaireMissing: 1, completionRate: 0.6667, arrived: 0, walkIns: 0, ...over
  });

  const forget = () => { try { localStorage.removeItem(VIEW_STORAGE_KEY); } catch { /* storage unavailable */ } };

  beforeEach(async () => {
    forget();
    await TestBed.configureTestingModule({
      providers: [providePermissions('NURSE')],
      imports: [
        I18nTestingModule.forLang(), HttpClientTestingModule,
        RouterTestingModule.withRoutes([{ path: 'appointments', component: BlankComponent }, { path: 'appointments/arrivals', component: BlankComponent }])
      ],
      declarations: [AppointmentsComponent, BlankComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppointmentsComponent);
    component = fixture.componentInstance;
    component.date = '2026-10-14'; // a Wednesday
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    forget();
  });

  /** Changes the view the way the view links do: a navigation to /appointments?view=… (the component follows the URL). */
  async function go(view: 'day' | 'week'): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(`/appointments?view=${view}`);
    fixture.detectChanges();
  }

  function flush(from: string, to: string, list: any[] = [], m: Partial<AppointmentMetrics> = {}) {
    const l = http.expectOne(r => r.url === api);
    expect(l.request.params.get('from')).toBe(from);
    expect(l.request.params.get('to')).toBe(to);
    const mr = http.expectOne(r => r.url === `${api}/metrics`);
    expect(mr.request.params.get('from')).toBe(from);
    expect(mr.request.params.get('to')).toBe(to);
    l.flush(list);
    mr.flush(metrics({ from, to, ...m }));
    fixture.detectChanges();
  }

  const click = (id: string) => { (el.querySelector('#' + id) as HTMLButtonElement).click(); };

  it('loads the day range by default', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    expect(el.querySelector('#view-day')!.getAttribute('aria-current')).toBe('page');
    expect(el.querySelector('#view-week')!.getAttribute('aria-current')).toBeNull();
    expect(el.querySelector('[aria-pressed]')).toBeNull();
  });

  it('week view runs Monday to Sunday', async () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    await go('week');
    flush('2026-10-12', '2026-10-18');
  });

  it('Previous/Next move by 1 day in day view and 7 days in week view', async () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    click('next');
    flush('2026-10-15', '2026-10-15');
    click('prev');
    click('prev');
    // the first prev was superseded by the second: only the latest pair is live
    const lists = http.match(r => r.url === api).filter(r => !r.cancelled);
    const mets = http.match(r => r.url === `${api}/metrics`).filter(r => !r.cancelled);
    expect(lists.map(r => r.request.params.get('from'))).toEqual(['2026-10-13']);
    lists.forEach(r => r.flush([]));
    mets.forEach(r => r.flush(metrics()));
    await go('week');
    flush('2026-10-12', '2026-10-18'); // 2026-10-13 is still in the week of Oct 12
    click('next');
    flush('2026-10-19', '2026-10-25');
  });

  it('cancels a superseded load so only the latest day is rendered', () => {
    fixture.detectChanges();
    const a = { list: http.expectOne(r => r.url === api), met: http.expectOne(r => r.url === `${api}/metrics`) };
    click('next');
    const b = { list: http.expectOne(r => r.url === api && r.params.get('from') === '2026-10-15'),
      met: http.expectOne(r => r.url === `${api}/metrics` && r.params.get('from') === '2026-10-15') };
    expect(a.list.cancelled).toBeTrue();
    expect(a.met.cancelled).toBeTrue();
    b.list.flush([appointment({ id: 7, scheduledAt: '2026-10-15T09:00:00' })]);
    b.met.flush(metrics({ total: 9 }));
    fixture.detectChanges();
    expect(component.count).toBe(1);
    expect(component.metrics!.total).toBe(9);
    expect(Array.from(el.querySelectorAll('.board-group h3')).map(h => h.textContent!.trim())).toEqual(['Scheduled · awaiting questionnaire 1']);
  });

  it('clears groups and metrics when a load fails', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00' })]);
    expect(component.groups.length).toBe(1);
    click('next');
    http.expectOne(r => r.url === api).flush({}, { status: 500, statusText: 'Server Error' });
    http.match(r => r.url === `${api}/metrics`);
    fixture.detectChanges();
    expect(component.groups).toEqual([]);
    expect(component.metrics).toBeNull();
    expect(component.errorMessage).toBeTruthy();
  });

  it('renders the KPI strip: 67% for 0.6667 and a dash for null', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    const card = el.querySelector('.metrics')!.textContent!;
    expect(card).toContain('Questionnaires completed');
    expect(card).toContain('Needs review');
    expect(card).toContain('Questionnaire missing');
    expect(card).toContain('Cancelled / no-show');
    expect(card).toContain('2 of 2 before the visit');
    expect(card).toContain('1 cancelled · 1 no-show');
    const values = Array.from(el.querySelectorAll('.tile__value')).map(v => v.textContent!.replace(/\s+/g, ' ').trim());
    expect(values).toEqual(['67%', '1 / 3', '1 / 3', '2 / 3']);
    expect(Array.from(el.querySelectorAll('.tile__label')).map(l => l.textContent!.trim())[0]).toBe('Questionnaires completed');
    expect(el.querySelector('.metrics .card__title')!.textContent).toBe('Today');
    expect(el.querySelector('.helper-line')!.textContent).toContain('roughly 10 minutes');
    expect(el.querySelector('.helper-line')!.textContent).toContain('estimate: 5 min each');

    click('next');
    flush('2026-10-15', '2026-10-15', [], { completionRate: null, questionnairesCompleted: 0 });
    expect(el.querySelectorAll('.tile__value')[0].textContent!.trim()).toBe('—');
    expect(el.querySelector('.helper-line')!.textContent).toContain('No questionnaires completed ahead of time');
  });

  it('day view: readiness board groups, order, chips and a collapsed closed group', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [
      appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00', status: 'NEEDS_REVIEW', flagCount: 2 }),
      appointment({ id: 2, scheduledAt: '2026-10-14T11:00:00', status: 'SCHEDULED', questionnaireMissing: true }),
      appointment({ id: 3, scheduledAt: '2026-10-14T09:00:00', status: 'COMPLETED' })
    ]);
    expect(Array.from(el.querySelectorAll('.board-group h3')).map(h => h.textContent!.trim()))
      .toEqual(['Needs review 1', 'Questionnaire missing 1']);
    const closed = el.querySelector('details.board-closed') as HTMLDetailsElement;
    expect(closed.open).toBeFalse();
    expect(closed.querySelector('summary')!.textContent).toContain('Completed, cancelled & no-show');
    expect(closed.querySelector('summary .badge')!.textContent).toBe('1');
    const first = el.querySelector('.appt-card')!;
    expect(first.textContent).toContain('08:30–09:00');
    expect(first.textContent).toContain('Jane Doe');
    expect(first.textContent).toContain('Pre op consult');
    expect(first.textContent).toContain('Dr. Roy');
    expect(first.textContent).toContain('Clinic A');
    expect(first.textContent).toContain('2 flags');
    expect(first.querySelector('a')!.getAttribute('href')).toBe('/appointments/1');
    expect(Array.from(el.querySelectorAll('.appt-card .chip__label')).map(b => b.textContent))
      .toContain('Needs review');
    expect(el.textContent).not.toContain('No appointments.');
  });

  it('omits a redacted (null) specialty in the board, the list and the week grid', async () => {
    const redacted = [
      appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00', status: 'NEEDS_REVIEW', specialty: null }),
      appointment({ id: 2, scheduledAt: '2026-10-14T09:30:00', status: 'READY', specialty: null })
    ];
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', redacted);
    const card = el.querySelector('.appt-card')!;
    expect(card.textContent).toContain('Pre op consult');
    expect(card.querySelector('.appt-card__meta')!.textContent!.trim()).toBe('Pre op consult');
    expect(el.textContent).not.toMatch(/null|undefined/);
    await go('week');
    flush('2026-10-12', '2026-10-18', redacted);
    expect(el.querySelectorAll('.week-block').length).toBe(2);
    expect(el.textContent).not.toMatch(/null|undefined/);
  });

  it('Mark reviewed posts and reloads', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [appointment({ id: 1, status: 'NEEDS_REVIEW' })]);
    (el.querySelector('.btn-reviewed') as HTMLButtonElement).click();
    http.expectOne(`${api}/1/review`).flush(appointment({ id: 1, status: 'READY' }));
    flush('2026-10-14', '2026-10-14', [appointment({ id: 1, status: 'READY' })]);
    expect(el.querySelector('[data-group=ready]')).not.toBeNull();
  });

  it('week view renders 7 day columns and positions blocks', async () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    await go('week');
    flush('2026-10-12', '2026-10-18', [appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00', status: 'NEEDS_REVIEW' })]);
    expect(el.querySelectorAll('.week-day').length).toBe(7);
    const block = el.querySelector('.week-block') as HTMLElement;
    expect(block.style.top).toBe('144px');
    expect(block.style.height).toBe('48px');
    expect(block.textContent).toContain('Needs review');
    expect(block.textContent).toContain('08:30');
    expect(block.textContent).toContain('Jane Doe');
    expect(block.querySelector('.week-block__glyph')!.textContent).toBe('◆');
    expect(block.getAttribute('href')).toBe('/appointments/1');
    expect(el.textContent).toContain('12 Oct – 18 Oct 2026');
  });

  it('week view: back-to-back 15-minute blocks sit in separate lanes and none is shorter than 44px', async () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    await go('week');
    flush('2026-10-12', '2026-10-18', [
      appointment({ id: 1, scheduledAt: '2026-10-14T09:00:00', durationMinutes: 15 }),
      appointment({ id: 2, scheduledAt: '2026-10-14T09:15:00', durationMinutes: 15 })]);
    const blocks = Array.from(el.querySelectorAll('.week-block')) as HTMLElement[];
    expect(blocks.length).toBe(2);
    expect(blocks.every(b => parseFloat(b.style.height) >= 44)).toBeTrue();
    expect(blocks[0].style.left).not.toBe(blocks[1].style.left);
    expect(blocks[0].style.width).toBe('calc(50% - 2px)');
  });

  it('week view: the agenda uses human headings and today is a pill with screen-reader text', async () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    await go('week');
    flush('2026-10-12', '2026-10-18', [appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00' })]);
    expect(el.querySelector('.agenda .card__title--sm')!.textContent).toContain('Wednesday 14 October');
    expect(el.querySelector('.hero__sub')!.textContent).toContain('12 Oct – 18 Oct 2026');
    expect(el.querySelector('h1')!.textContent).toBe('Appointments');
  });

  it('shows the empty state', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    expect(el.textContent).toContain('No appointments.');
  });

  it('links to the new appointment form', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    const link = Array.from(el.querySelectorAll('a')).find(a => a.textContent!.includes('New appointment'))!;
    expect(link.getAttribute('href')).toBe('/appointments/new');
  });

  describe('view links and the remembered view', () => {
    it('are three links, none a toggle button; the current one carries aria-current', () => {
      fixture.detectChanges();
      flush('2026-10-14', '2026-10-14');
      const day = el.querySelector('#view-day') as HTMLAnchorElement;
      const week = el.querySelector('#view-week') as HTMLAnchorElement;
      const arrivals = el.querySelector('#view-arrivals') as HTMLAnchorElement;
      expect([day.tagName, week.tagName, arrivals.tagName]).toEqual(['A', 'A', 'A']);
      expect(day.getAttribute('href')).toBe('/appointments?view=day');
      expect(week.getAttribute('href')).toBe('/appointments?view=week');
      expect(arrivals.getAttribute('href')).toBe('/appointments/arrivals');
      expect(arrivals.textContent!.trim()).toBe('Arrivals');
      expect(el.querySelectorAll('.pill-group__item[aria-current=page]').length).toBe(1);
    });

    it('clicking Week navigates to ?view=week, shows the week and remembers it', async () => {
      fixture.detectChanges();
      flush('2026-10-14', '2026-10-14');
      click('view-week');
      await fixture.whenStable();
      fixture.detectChanges();
      flush('2026-10-12', '2026-10-18');
      expect(TestBed.inject(Router).url).toBe('/appointments?view=week');
      expect(el.querySelector('#view-week')!.getAttribute('aria-current')).toBe('page');
      expect(el.querySelector('#view-day')!.getAttribute('aria-current')).toBeNull();
      expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe('week');
    });

    it('?view=week survives a reload (a new component on the same URL starts in week view)', async () => {
      await TestBed.inject(Router).navigateByUrl('/appointments?view=week');
      fixture.detectChanges();
      flush('2026-10-12', '2026-10-18');
      expect(component.view).toBe('week');
      expect(el.querySelector('.week')).not.toBeNull();
    });

    it('an unknown ?view= value is the day view and is not remembered as arrivals', async () => {
      await TestBed.inject(Router).navigateByUrl('/appointments?view=arrivals');
      fixture.detectChanges();
      flush('2026-10-14', '2026-10-14');
      expect(component.view).toBe('day');
      expect(TestBed.inject(Router).url).toBe('/appointments?view=arrivals');
    });

    it('without ?view= and with "week" remembered, opens the week view', () => {
      localStorage.setItem(VIEW_STORAGE_KEY, 'week');
      fixture.detectChanges();
      flush('2026-10-12', '2026-10-18');
      expect(component.view).toBe('week');
    });

    it('without ?view= and with "arrivals" remembered, replaces the URL with /appointments/arrivals and loads nothing', async () => {
      localStorage.setItem(VIEW_STORAGE_KEY, 'arrivals');
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      fixture.detectChanges();
      expect(navigate).toHaveBeenCalledOnceWith(['/appointments/arrivals'], { replaceUrl: true });
      http.expectNone(r => r.url === api);
    });

    it('with "arrivals" remembered, the redirect really lands on the arrivals route', async () => {
      localStorage.setItem(VIEW_STORAGE_KEY, 'arrivals');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/appointments/arrivals');
      http.expectNone(r => r.url === api);
    });

    it('an explicit ?view=day beats a remembered "arrivals"', async () => {
      localStorage.setItem(VIEW_STORAGE_KEY, 'arrivals');
      await TestBed.inject(Router).navigateByUrl('/appointments?view=day');
      fixture.detectChanges();
      flush('2026-10-14', '2026-10-14');
      expect(component.view).toBe('day');
      expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe('day');
    });

    it('with a throwing localStorage lands on the day view and still works', () => {
      spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
      spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
      fixture.detectChanges();
      flush('2026-10-14', '2026-10-14');
      expect(component.view).toBe('day');
      expect(() => component.remember('week')).not.toThrow();
    });

    it('clicking the Arrivals link remembers "arrivals"', () => {
      fixture.detectChanges();
      flush('2026-10-14', '2026-10-14');
      click('view-arrivals');
      expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe('arrivals');
    });
  });

  describe('arrival from the day board', () => {
    const today = businessToday();
    const todayAt = (hhmm: string) => `${today}T${hhmm}:00`;
    const row = (arrivedAt: string | null) => arrivalRow({ appointmentId: 1, arrival: arrivedAt ? { arrivedAt, source: 'DESK', byName: 'Dev Reception' } : null });

    function loadToday(list: any[]) {
      component.date = today;
      fixture.detectChanges();
      flush(today, today, list);
    }

    it('shows "Mark arrived" for open rows of today in the review, ready, missing and awaiting groups, never for closed or other days', () => {
      loadToday([
        appointment({ id: 1, scheduledAt: todayAt('08:00'), status: 'NEEDS_REVIEW' }),
        appointment({ id: 2, scheduledAt: todayAt('09:00'), status: 'READY' }),
        appointment({ id: 3, scheduledAt: todayAt('10:00'), status: 'SCHEDULED', questionnaireMissing: true }),
        appointment({ id: 4, scheduledAt: todayAt('11:00'), status: 'SCHEDULED', questionnaireMissing: false }),
        appointment({ id: 5, scheduledAt: todayAt('12:00'), status: 'COMPLETED' }),
        appointment({ id: 6, scheduledAt: addDays(today, 1) + 'T09:00:00', status: 'READY' })
      ]);
      for (const id of [1, 2, 3, 4]) {
        expect(el.querySelector('#arrive-' + id)).withContext('arrive-' + id).not.toBeNull();
      }
      expect(el.querySelector('#arrive-5')).toBeNull();
      expect(el.querySelector('#arrive-6')).toBeNull();
      expect(el.querySelector('#arrive-1')!.textContent!.trim()).toBe('Mark arrived');
      expect(el.querySelector('#arrive-1')!.classList).toContain('btn--secondary');
    });

    it('POSTs once, updates the row in place (chip, sorts first, undo button) and does not reload the page data', () => {
      loadToday([
        appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'READY' }),
        appointment({ id: 2, scheduledAt: todayAt('08:00'), status: 'READY' })
      ]);
      expect(Array.from(el.querySelectorAll('.appt-card__name')).map(a => a.getAttribute('href'))).toEqual(['/appointments/2', '/appointments/1']);
      click('arrive-1');
      const req = http.expectOne(`${api}/1/arrival`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(row('2026-10-14T13:52:03Z'));
      fixture.detectChanges();
      http.expectNone(r => r.url === api);
      expect(Array.from(el.querySelectorAll('.appt-card__name')).map(a => a.getAttribute('href'))).toEqual(['/appointments/1', '/appointments/2']);
      expect(el.querySelector('#arrive-1')).toBeNull();
      expect(el.querySelector('#undo-arrival-1')!.textContent!.trim()).toBe('Undo arrival');
      const chips = Array.from(el.querySelectorAll('.appt-card')[0].querySelectorAll('.chip__label')).map(c => c.textContent);
      expect(chips).toContain('Here');
      expect(el.querySelector('[aria-live=polite]')!.textContent).toContain('Arrival of Jane Doe recorded');
      expect(el.querySelector('#arrive-2')).not.toBeNull();
    });

    it('a second click while the request is in flight sends nothing more', () => {
      loadToday([appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'READY' })]);
      click('arrive-1');
      fixture.detectChanges();
      expect((el.querySelector('#arrive-1') as HTMLButtonElement).disabled).toBeTrue();
      component.arrive(component.board[0].items[0]);
      http.expectOne(`${api}/1/arrival`).flush(row('2026-10-14T13:52:03Z'));
    });

    it('undo DELETEs without confirmation and puts the row back', () => {
      const confirm = spyOn(window, 'confirm');
      loadToday([appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'READY', arrivedAt: '2026-10-14T13:52:03Z', arrivalSource: 'DESK' })]);
      expect(el.querySelector('#arrive-1')).toBeNull();
      click('undo-arrival-1');
      const req = http.expectOne(`${api}/1/arrival`);
      expect(req.request.method).toBe('DELETE');
      req.flush(row(null));
      fixture.detectChanges();
      expect(el.querySelector('#undo-arrival-1')).toBeNull();
      expect(el.querySelector('#arrive-1')).not.toBeNull();
      expect(confirm).not.toHaveBeenCalled();
      expect(el.querySelector('[aria-live=polite]')!.textContent).toContain('Arrival of Jane Doe undone');
    });

    it('a 409 shows the action error and reloads the list; other errors keep the list', () => {
      loadToday([appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'READY' })]);
      click('arrive-1');
      http.expectOne(`${api}/1/arrival`).flush({ status: 409, error: 'INVALID_STATE', message: 'Appointment is closed', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')!.textContent).toContain('This appointment is closed.');
      flush(today, today, [appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'COMPLETED' })]);
      expect(el.querySelector('[role=alert]')).not.toBeNull();
      expect(el.querySelector('#arrive-1')).toBeNull();
    });

    it('a 500 shows the translated fallback and keeps the row', () => {
      loadToday([appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'READY' })]);
      click('arrive-1');
      http.expectOne(`${api}/1/arrival`).flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el.querySelector('[role=alert]')).not.toBeNull();
      expect(el.querySelector('#arrive-1')).not.toBeNull();
      expect(component.actionError).toBeTruthy();
    });

    it('the week agenda has no arrive button', async () => {
      component.date = today;
      fixture.detectChanges();
      flush(today, today);
      await go('week');
      flush(mondayOf(today), addDays(mondayOf(today), 6), [appointment({ id: 1, scheduledAt: todayAt('09:00'), status: 'READY' })]);
      expect(el.querySelector('.btn-arrive')).toBeNull();
    });
  });
});

describe('AppointmentsComponent permissions on the arrival controls', () => {
  const api = `${environment.apiUrl}/appointments`;
  const today = businessToday();

  async function render(permissions: Permission[]) {
    await TestBed.configureTestingModule({
      providers: [providePermissions('NURSE', { permissions })],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, RouterTestingModule],
      declarations: [AppointmentsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AppointmentsComponent);
    fixture.componentInstance.date = today;
    fixture.detectChanges();
    http.expectOne(r => r.url === api).flush([
      appointment({ id: 1, scheduledAt: `${today}T09:00:00`, status: 'READY' }),
      appointment({ id: 2, scheduledAt: `${today}T10:00:00`, status: 'READY', arrivedAt: '2026-10-14T13:52:03Z', arrivalSource: 'DESK' })
    ]);
    http.expectOne(r => r.url === `${api}/metrics`).flush({ from: today, to: today, total: 2, scheduled: 0, ready: 2, needsReview: 0, cancelled: 0, completed: 0, noShow: 0, questionnairesCompleted: 0, questionnaireMissing: 0, completionRate: null, arrived: 1, walkIns: 0 });
    fixture.detectChanges();
    http.verify();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => { try { localStorage.removeItem(VIEW_STORAGE_KEY); } catch { /* storage unavailable */ } });

  it('without APPOINTMENT_WRITE there is no arrive and no undo button, but the arrived chip stays', async () => {
    const el = await render(['APPOINTMENT_READ']);
    expect(el.querySelector('.btn-arrive')).toBeNull();
    expect(el.querySelector('.btn-undo-arrival')).toBeNull();
    expect(Array.from(el.querySelectorAll('.chip__label')).map(c => c.textContent)).toContain('Here');
  });

  it('without APPOINTMENT_READ there is no Arrivals link', async () => {
    const el = await render([]);
    expect(el.querySelector('#view-arrivals')).toBeNull();
    expect(el.querySelector('#view-day')).not.toBeNull();
  });

  it('with APPOINTMENT_WRITE both controls show', async () => {
    const el = await render(['APPOINTMENT_READ', 'APPOINTMENT_WRITE']);
    expect(el.querySelector('#arrive-1')).not.toBeNull();
    expect(el.querySelector('#undo-arrival-2')).not.toBeNull();
  });
});

describe('appointments routes', () => {
  it('declares the arrivals route (lazy front-desk module) before :id', () => {
    const paths = APPOINTMENTS_ROUTES.map(r => r.path);
    expect(paths.indexOf('arrivals')).toBeGreaterThan(-1);
    expect(paths.indexOf('arrivals')).toBeLessThan(paths.indexOf(':id'));
    expect(typeof APPOINTMENTS_ROUTES[paths.indexOf('arrivals')].loadChildren).toBe('function');
  });

  it('navigating to /arrivals activates the arrivals route and never loads the detail module', async () => {
    @Component({ template: '' })
    class ArrivalsStub {}
    let detailLoaded = 0;
    const routes: Routes = APPOINTMENTS_ROUTES.map(r =>
      r.path === 'arrivals' ? { path: 'arrivals', component: ArrivalsStub }
        : r.path === ':id' ? { path: ':id', loadChildren: () => { detailLoaded++; return Promise.resolve([] as Routes); } } : r);
    TestBed.configureTestingModule({ imports: [RouterTestingModule.withRoutes(routes)], declarations: [ArrivalsStub] });
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/arrivals')).toBeTrue();
    expect(router.routerState.snapshot.root.firstChild!.component).toBe(ArrivalsStub);
    expect(detailLoaded).toBe(0);
  });
});
