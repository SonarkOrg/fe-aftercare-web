import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { AlertCountService } from '../../Services/AlertCount.service';
import { MessageCountService } from '../../Services/MessageCount.service';
import { StaffAuth } from '../../auth/staff-auth';
import { ShellComponent } from '../../shell/shell.component';
import { environment } from '../../../environments/environment';
import { AccessRole } from '../../models/me.model';
import { Patient } from '../../models/patient.model';
import { addDays, businessToday } from '../../shared/link.util';
import { SEED_RULES, alertDto, appointment, checkInDto, followUp, providePermissions } from '../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { PatientsComponent } from './patients.component';

describe('PatientsComponent', () => {
  let component: PatientsComponent;
  let fixture: ComponentFixture<PatientsComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const base = `${api}/patients`;
  const today = businessToday();

  const person = (id: number, firstName: string, lastName: string, over: Partial<Patient> = {}): Patient => ({
    id, firstName, lastName, email: `${firstName.toLowerCase()}@example.com`, phone: '555-0100', gender: 'female',
    address: { city: 'Montréal', state: 'QC', zip: 'H1A' },
    activeFollowUp: followUp({ id: 10 + id, patientId: id, dischargeDate: addDays(today, -3), endDate: addDays(today, 4) }), ...over
  });
  const marie = person(1, 'Marie', 'Tremblay');
  const jean = person(2, 'Jean', 'Roy');
  const sophie = person(3, 'Sophie', 'Lavoie', { activeFollowUp: null });
  const alerts = [alertDto({ id: 1, patientId: 1 }), alertDto({ id: 2, patientId: 1, linkId: 'TEMPERATURE' }), alertDto({ id: 3, patientId: 2 })];
  const checkIns = [checkInDto({ id: 1, patientId: 1, followUpId: 11, checkInDate: addDays(today, -1), pain: 8 })];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [providePermissions('ADMIN')],
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    document.body.classList.remove('drawer-open');
    http.verify();
  });

  function create() {
    fixture = TestBed.createComponent(PatientsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  }

  function flushFeeds(patients: Patient[] = [marie, jean, sophie]) {
    http.expectOne(base).flush(patients);
    http.expectOne(r => r.url === `${api}/alerts`).flush(patients.length ? alerts : []);
    http.expectOne(r => r.url === `${api}/check-ins`).flush(patients.length ? checkIns : []);
    http.expectOne(r => r.url === `${api}/appointments`).flush(
      patients.length ? [appointment({ id: 9, patientId: 1, scheduledAt: addDays(today, 1) + 'T10:30:00', type: 'PRE_OP_CONSULT' })] : []);
    http.match(`${api}/questionnaires/7`).forEach(r => r.flush({ id: 7, rules: SEED_RULES, questionnaire: {} }));
    fixture.detectChanges();
  }

  function init(patients?: Patient[]) {
    create();
    fixture.detectChanges();
    flushFeeds(patients);
  }

  const tab = (key: string) => el.querySelector(`[data-filter=${key}]`) as HTMLButtonElement;
  const rows = () => Array.from(el.querySelectorAll('li.prow')) as HTMLElement[];

  it('loads the four feeds and renders one row per patient, critical first', () => {
    init();
    expect(rows().length).toBe(3);
    // both critical patients first (tie broken by last name), then the inactive one
    expect(rows()[0].textContent).toContain('Jean Roy');
    expect(rows()[1].textContent).toContain('Marie Tremblay');
    expect(rows()[2].textContent).toContain('Sophie Lavoie');
    expect(rows()[1].querySelector('a')!.getAttribute('href')).toBe('/patients/1');
    expect(rows()[1].textContent).toContain('Day 3 of 7');
    expect(rows()[1].textContent).toContain('Yesterday');
    expect(rows()[1].textContent).toContain('2 high alerts open');
    expect(rows()[1].textContent).toContain('Pre op consult');
    expect(rows()[1].textContent).toContain('8');
    expect(rows()[2].textContent).toContain('Inactive');
    expect(rows()[2].textContent).toContain('None in 30 days');
  });

  it('renders a card list (no table): a sentence-case header line hidden from assistive tech, sr-only cell labels', () => {
    init();
    expect(el.querySelector('table')).toBeNull();
    const head = el.querySelector('.prow--head')!;
    expect(head.getAttribute('aria-hidden')).toBe('true');
    expect(head.textContent).toContain('Last check-in');
    expect(rows()[0].querySelector('.sr-only')!.textContent).toBe('Status: ');
    expect(el.querySelector('.hero__sub')!.textContent).toBe('3 patients · 2 in active follow-up');
    expect(el.querySelector('h1')!.textContent).toBe('Patients');
  });

  it('shows "No patients yet." when the list is empty', () => {
    init([]);
    expect(el.textContent).toContain('No patients yet.');
  });

  it('shows an error with Retry, not "No patients yet.", when loading fails', () => {
    spyOn(console, 'error');
    create();
    fixture.detectChanges();
    http.expectOne(base).flush('boom', { status: 500, statusText: 'Server Error' });
    http.match(() => true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Could not load patients.');
    expect(el.textContent).not.toContain('No patients yet.');
    expect(el.textContent).toContain('Retry');
  });

  it('filter-tab counts: All 3 / Critical 2 / Attention 0 / Stable 0 / Inactive 1', () => {
    init();
    expect(['all', 'critical', 'attention', 'stable', 'inactive'].map(k => tab(k).getAttribute('aria-label')))
      .toEqual(['All, 3', 'Critical, 2', 'Needs attention, 0', 'Stable, 0', 'Inactive, 1']);
  });

  it('clicking Critical shows 2 rows and sets aria-pressed', () => {
    init();
    tab('critical').click();
    fixture.detectChanges();
    expect(rows().length).toBe(2);
    expect(tab('critical').getAttribute('aria-pressed')).toBe('true');
    expect(tab('all').getAttribute('aria-pressed')).toBe('false');
  });

  it('search is case-insensitive and updates the tab counts', () => {
    init();
    component.setQuery('tremblay');
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    expect(tab('critical').getAttribute('aria-label')).toBe('Critical, 1');
    expect(tab('inactive').getAttribute('aria-label')).toBe('Inactive, 0');
  });

  it('search is accent-insensitive', () => {
    init([person(4, 'Zoé', 'Côté')]);
    component.setQuery('zoe cote');
    fixture.detectChanges();
    expect(rows().length).toBe(1);
    component.setQuery('cote zoe');
    fixture.detectChanges();
    expect(rows().length).toBe(1);
  });

  it('shows the filtered empty state with Clear filters', () => {
    init();
    component.setQuery('nobody');
    fixture.detectChanges();
    expect(el.textContent).toContain('No patients match these filters.');
    (Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Clear filters')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows().length).toBe(3);
  });

  const sortSelect = () => el.querySelector('#sort-key') as HTMLSelectElement;
  const dirButton = () => el.querySelector('#sort-dir') as HTMLButtonElement;
  function chooseSort(label: string) {
    const opt = Array.from(sortSelect().options).find(o => o.textContent!.trim() === label)!;
    sortSelect().value = opt.value;
    sortSelect().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('sorting by Last check-in toggles the direction label and keeps nulls last', () => {
    init();
    chooseSort('Last check-in');
    expect(dirButton().getAttribute('aria-label')).toBe('Last check-in: ascending. Switch to descending');
    expect(rows()[0].textContent).toContain('Marie');
    dirButton().click();
    fixture.detectChanges();
    expect(dirButton().getAttribute('aria-label')).toBe('Last check-in: descending. Switch to ascending');
    expect(rows()[0].textContent).toContain('Marie');
    expect(rows()[2].textContent).toContain('Roy'); // nulls last either way
  });

  it('Open alerts starts at descending and the announced direction matches the actual order', () => {
    init();
    chooseSort('Open alerts');
    expect(component.sortDir).toBe('desc');
    expect(dirButton().getAttribute('aria-label')).toContain('Open alerts: descending');
    expect(rows().map(r => r.querySelector('.prow__name')!.textContent)).toEqual(['Marie Tremblay', 'Jean Roy', 'Sophie Lavoie']); // 2, 1, 0 alerts
    dirButton().click();
    fixture.detectChanges();
    expect(dirButton().getAttribute('aria-label')).toContain('Open alerts: ascending');
    expect(rows().map(r => r.querySelector('.prow__name')!.textContent)).toEqual(['Sophie Lavoie', 'Jean Roy', 'Marie Tremblay']);
    expect(el.querySelector('[aria-live=polite].sr-only')!.textContent).toContain('sorted by Open alerts, ascending');
  });

  it('the ▲ marker beside a pain value is hidden from AT and followed by sr-only text', () => {
    init([marie]);
    const flag = el.querySelector('.pain-flag')!;
    expect(flag.getAttribute('aria-hidden')).toBe('true');
    expect(flag.nextElementSibling!.classList).toContain('sr-only');
    expect(flag.nextElementSibling!.textContent).toBe(', at or above alert threshold');
    expect(el.querySelector('.c-pain [aria-label]:not(svg):not(g)')).toBeNull();
  });

  it('row click navigates; clicking Delete does not', () => {
    init();
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(window, 'confirm').and.returnValue(false);
    (rows()[0].querySelector('.prow__status') as HTMLElement).click();
    expect(nav).toHaveBeenCalledWith(['/patients', 2]); // first row = Jean Roy
    nav.calls.reset();
    (rows()[0].querySelector('.btn--ghost-danger') as HTMLButtonElement).click();
    expect(nav).not.toHaveBeenCalled();
  });

  it('DELETE reloads when confirmed; nothing is sent when cancelled', () => {
    init();
    const confirmSpy = spyOn(window, 'confirm').and.returnValues(false, true);
    component.deletePatient(marie);
    http.expectNone(`${base}/1`);
    component.deletePatient(marie);
    expect(confirmSpy).toHaveBeenCalledWith('Delete Marie Tremblay?');
    http.expectOne(`${base}/1`).flush(null, { status: 204, statusText: 'No Content' });
    flushFeeds([]);
  });

  it('explains a 409 on delete', () => {
    spyOn(console, 'error');
    init();
    spyOn(window, 'confirm').and.returnValue(true);
    component.deletePatient(marie);
    http.expectOne(`${base}/1`).flush({ status: 409, error: 'PATIENT_HAS_RECORDS', message: 'x', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Patient has follow-up or appointment records and cannot be deleted.');
  });

  describe('add-patient drawer', () => {
    it('opens, focuses first name, traps nothing outside and closes on Esc returning focus', async () => {
      init();
      const trigger = el.querySelector('#open-add-patient') as HTMLButtonElement;
      document.body.appendChild(el);
      trigger.focus();
      trigger.click();
      fixture.detectChanges();
      expect(el.querySelector('.drawer')!.getAttribute('role')).toBe('dialog');
      expect(document.body.classList).toContain('drawer-open');
      await new Promise(r => setTimeout(r));
      expect(document.activeElement!.id).toBe('new-firstName');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(el.querySelector('.drawer')).toBeNull();
      expect(document.body.classList).not.toContain('drawer-open');
      expect(document.activeElement).toBe(trigger);
      el.remove();
    });

    it('Tab cycles inside the drawer: from the last control to the first, Shift+Tab from the first to the last', async () => {
      init();
      document.body.appendChild(el);
      component.openDrawer(null);
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
      const drawer = el.querySelector('.drawer') as HTMLElement;
      const focusables = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      expect(first.getAttribute('aria-label')).toBe('Close');
      expect(last.textContent).toContain('Cancel'); // the submit button is disabled until the form is valid
      const press = (shiftKey: boolean) => {
        const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true, bubbles: true });
        document.dispatchEvent(ev);
        return ev;
      };
      last.focus();
      expect(press(false).defaultPrevented).toBeTrue();
      expect(document.activeElement).toBe(first);
      expect(press(true).defaultPrevented).toBeTrue();
      expect(document.activeElement).toBe(last);
      // in the middle the browser's own Tab order is left alone
      focusables[2].focus();
      expect(press(false).defaultPrevented).toBeFalse();
      expect(drawer.contains(document.activeElement)).toBeTrue();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      el.remove();
    });

    it('?add=1 opens it', async () => {
      await router.navigateByUrl('/?add=1');
      init();
      expect(el.querySelector('.drawer')).not.toBeNull();
    });

    it('sends the optional date of birth, null when left empty', () => {
      init([]);
      component.openDrawer(null);
      fixture.detectChanges();
      expect(el.querySelector<HTMLInputElement>('#new-dob')!.max).toBe(addDays(businessToday(), -1));
      component.patient = { firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com', phone: '555-0111', gender: 'female', dateOfBirth: '', address: { city: 'Austin', state: 'TX', zip: '73301' } };
      component.addPatient();
      const post = http.expectOne(`${base}/register`);
      expect(post.request.body.dateOfBirth).toBeNull();
      post.flush({ ...post.request.body, id: 9 });
      http.match(() => true).forEach(r => r.flush([]));
    });

    it('POSTs a new patient without id, closes, reloads and shows a notice', () => {
      init([]);
      component.openDrawer(null);
      fixture.detectChanges();
      component.patient = { firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com', phone: '555-0111', gender: 'female', address: { city: 'Austin', state: 'TX', zip: '73301' } };
      expect(component.isFormValid()).toBeTrue();
      component.addPatient();
      expect(component.saving).toBeTrue();
      const post = http.expectOne(`${base}/register`);
      expect(post.request.method).toBe('POST');
      expect('id' in post.request.body).toBeFalse();
      post.flush({ ...post.request.body, id: 9 });
      expect(component.saving).toBeFalse();
      expect(component.patient.firstName).toBe('');
      expect(component.drawerOpen).toBeFalse();
      flushFeeds([sophie]);
      expect(el.textContent).toContain('Patient added.');
      component.ngOnDestroy();
    });
  });
});

describe('PatientsComponent inside the shell (real typing)', () => {
  const api = environment.apiUrl;
  const today = businessToday();
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule.withRoutes([{ path: 'patients', component: PatientsComponent, data: { title: 'Patients' } }])],
      declarations: [PatientsComponent, ShellComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), 
        { provide: StaffAuth, useValue: { userName$: of('Dev Nurse'), logout: () => undefined } },
        { provide: AlertCountService, useValue: { openCount$: of(0), refresh: jasmine.createSpy('refresh') } },
        { provide: MessageCountService, useValue: { unread$: of(0), refresh: jasmine.createSpy('refresh'), start: () => undefined, stop: () => undefined } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('keeps every keystroke and focus in the search box while the URL updates; the page does not steal focus', async () => {
    const people: Patient[] = ['Marie Tremblay', 'Jean Roy', 'Sophie Lavoie'].map((n, i) => ({
      id: i + 1, firstName: n.split(' ')[0], lastName: n.split(' ')[1], email: 'x@example.com', phone: '555-0100', gender: 'female',
      address: { city: 'c', state: 's', zip: 'z' },
      activeFollowUp: followUp({ id: 20 + i, patientId: i + 1, dischargeDate: addDays(today, -2), endDate: addDays(today, 5) })
    }));
    const shell = TestBed.createComponent(ShellComponent);
    document.body.appendChild(shell.nativeElement);
    shell.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/patients');
    shell.detectChanges();
    http.expectOne(`${api}/patients`).flush(people);
    http.expectOne(r => r.url === `${api}/alerts` && r.params.keys().length === 0).flush([]);
    http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
    http.expectOne(r => r.url === `${api}/appointments`).flush([]);
    http.match(`${api}/questionnaires/7`).forEach(r => r.flush({ id: 7, rules: SEED_RULES, questionnaire: {} }));
    shell.detectChanges();

    const main = shell.componentInstance.main.nativeElement;
    const mainFocus = spyOn(main, 'focus').and.callThrough();
    const input = shell.nativeElement.querySelector('#patient-search') as HTMLInputElement;
    input.focus();
    let typed = '';
    for (const ch of 'roy') {
      typed += ch;
      input.value = typed;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await shell.whenStable();
      shell.detectChanges();
      expect(input.value).toBe(typed);
      expect(document.activeElement).toBe(input);
    }
    expect(router.url).toBe('/patients?q=roy');
    expect(mainFocus).not.toHaveBeenCalled();
    expect(shell.nativeElement.querySelectorAll('li.prow').length).toBe(1);
    http.expectNone(r => r.url === `${api}/alerts`); // no alert-count refetch per keystroke
    shell.nativeElement.remove();
  });
});

describe('PatientsComponent by access role', () => {
  const api = environment.apiUrl;
  const today = businessToday();
  let fixture: ComponentFixture<PatientsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const plain = (id: number, firstName: string, lastName: string): Patient => ({
    id, firstName, lastName, email: `${firstName.toLowerCase()}@example.com`, phone: '555-0100', gender: 'female',
    address: { city: 'Montréal', state: 'QC', zip: 'H1A' }, activeFollowUp: null, unresolvedAlertCount: null
  });

  async function setup(role: AccessRole) {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientsComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions(role)]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientsComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  describe('RECEPTION', () => {
    beforeEach(async () => {
      await setup('RECEPTION');
      http.expectOne(`${api}/patients`).flush([plain(1, 'Marie', 'Tremblay'), plain(2, 'Jean', 'Roy')]);
      http.expectOne(r => r.url === `${api}/appointments`).flush([appointment({ id: 9, patientId: 1, scheduledAt: addDays(today, 1) + 'T10:30:00' })]);
      fixture.detectChanges();
    });

    it('asks only for the patient list and the schedule', () => {
      expect(http.match(r => r.url === `${api}/alerts`).length).toBe(0);
      expect(http.match(r => r.url === `${api}/check-ins`).length).toBe(0);
      expect(http.match(r => r.url.startsWith(`${api}/questionnaires`)).length).toBe(0);
    });

    it('hides the status, follow-up, last check-in and pain columns, the status filters and the alert sort', () => {
      expect(Array.from(el.querySelectorAll('.prow--head > span')).map(s => s.textContent!.trim().replace(/\s+/g, ' ')).filter(Boolean)).toEqual(['Patient', 'Next appointment']);
      for (const sel of ['.prow__status', '.c-fu', '.c-last', '.c-pain', 'app-status-chip', '.pill-group', 'app-trend-chart']) {
        expect(el.querySelector(sel)).withContext(sel).toBeNull();
      }
      expect(Array.from(el.querySelectorAll<HTMLOptionElement>('#sort-key option')).map(o => o.textContent!.trim())).toEqual(['Name', 'Next appointment']);
      expect(el.querySelector('.hero__sub')!.textContent).toBe('2 patients');
    });

    it('still shows name, e-mail and the next appointment, sorted by name', () => {
      const names = Array.from(el.querySelectorAll('.prow__name')).map(n => n.textContent!.trim());
      expect(names).toEqual(['Jean Roy', 'Marie Tremblay']);
      expect(el.querySelectorAll('.prow:not(.prow--head) .c-next')[1].textContent).toContain('Pre op consult'); // Marie, second by name
    });

    it('has no Delete action but keeps Open and Add patient (PATIENT_WRITE)', () => {
      expect(el.querySelector('.btn--ghost-danger')).toBeNull();
      expect(el.querySelectorAll('.prow__actions a.btn').length).toBe(2);
      expect(el.querySelector('#open-add-patient')).not.toBeNull();
    });

    it('ignores a ?status= filter it cannot offer', () => {
      expect(fixture.componentInstance.statusFilter).toBe('all');
      expect(el.querySelectorAll('.prow--plain').length).toBeGreaterThan(0);
    });
  });

  describe('NURSE', () => {
    it('shows the clinical columns but no Delete patient (ADMIN only)', async () => {
      await setup('NURSE');
      http.expectOne(`${api}/patients`).flush([{ ...plain(1, 'Marie', 'Tremblay'), activeFollowUp: followUp({ id: 11, patientId: 1, dischargeDate: addDays(today, -3), endDate: addDays(today, 4) }), unresolvedAlertCount: 0 }]);
      http.expectOne(r => r.url === `${api}/alerts`).flush([]);
      http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
      http.expectOne(r => r.url === `${api}/appointments`).flush([]);
      http.match(`${api}/questionnaires/7`).forEach(r => r.flush({ id: 7, rules: SEED_RULES, questionnaire: {} }));
      fixture.detectChanges();
      expect(el.querySelector('.pill-group')).not.toBeNull();
      expect(el.querySelector('.prow__status')).not.toBeNull();
      expect(el.querySelector('.c-fu')).not.toBeNull();
      expect(el.querySelector('.btn--ghost-danger')).toBeNull();
    });
  });

  describe('ADMIN', () => {
    it('can delete a patient', async () => {
      await setup('ADMIN');
      http.expectOne(`${api}/patients`).flush([{ ...plain(1, 'Marie', 'Tremblay'), unresolvedAlertCount: 0 }]);
      http.expectOne(r => r.url === `${api}/alerts`).flush([]);
      http.expectOne(r => r.url === `${api}/check-ins`).flush([]);
      http.expectOne(r => r.url === `${api}/appointments`).flush([]);
      fixture.detectChanges();
      expect(el.querySelector('.btn--ghost-danger[aria-label="Delete Marie Tremblay"]')).not.toBeNull();
    });
  });
});
