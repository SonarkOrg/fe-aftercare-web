import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ArrivalRow, Arrivals, PatientMatch, PatientSearchResult } from '../../../models/arrival.model';
import * as F from '../../../testing/fixtures';
import { PageHarness } from '../../../testing/page-harness';
import { FRONT_DESK_DECLARATIONS } from '../front-desk.testing';
import { ASK_TOAST_MS, ArrivalsComponent, CARD_TTL_MS } from './arrivals.component';

/** Phase 1B of the Arrivals page: card read, search results, walk-in, quick patient, family arrivals, expiry answer. */
const API = environment.apiUrl;
const NAM = 'ROYS85522712';
const NAM_DIGITS = '85522712';

const marie = F.arrivalRow({ relatedAppointmentIds: [78, 79] });
const jean = F.arrivalRow({
  appointmentId: 78, scheduledAt: '2026-10-14T14:30:00', status: 'SCHEDULED', questionnaire: 'RECEIVED',
  patient: F.deskPatient({ id: 13, firstName: 'Jean-François', lastName: 'Gagnon', dateOfBirth: '1985-02-03', ageYears: 41 })
});
const sophie = F.arrivalRow({
  appointmentId: 79, scheduledAt: '2026-10-14T16:00:00', status: 'SCHEDULED', questionnaire: 'RECEIVED',
  patient: F.deskPatient({ id: 14, firstName: 'Sophie', lastName: 'Roy', dateOfBirth: '1990-01-15', ageYears: 36, card: F.card({ onFile: true, expiry: null, status: 'UNKNOWN' }) })
});
const here = (r: ArrivalRow): ArrivalRow => ({ ...r, arrival: { arrivedAt: '2026-10-14T13:21:00Z', source: 'DESK', byName: 'Dev Reception' }, desk: { state: 'ARRIVED', reasons: [], notices: [] } });
const day = (rows: ArrivalRow[], over: Partial<Arrivals> = {}): Arrivals => F.arrivals({ rows, ...over });
const appt = (id: number, at: string, arrived = false) => ({ appointmentId: id, scheduledAt: at, type: 'PRE_OP_CONSULT' as const, status: 'READY' as const, arrived });
const matchOf = (r: ArrivalRow): PatientMatch => F.patientMatch({ patient: r.patient, todayAppointments: [appt(r.appointmentId, r.scheduledAt)] });
const stranger = (id: number, first: string, last: string, over: Partial<PatientMatch> = {}): PatientMatch =>
  F.patientMatch({ patient: F.deskPatient({ id, firstName: first, lastName: last, dateOfBirth: '1990-01-15', card: F.card({ onFile: false, expiry: null, status: 'NONE' }) }), todayAppointments: [], ...over });
const found = (over: Partial<PatientSearchResult>): PatientSearchResult => ({ mode: 'HEALTH_NUMBER', matches: [], candidates: [], warnings: [], ...over });
const apiError = (status: number, error: string, message = '', details?: unknown) => ({ status, error, message, fieldErrors: {}, ...(details ? { details } : {}) });

describe('ArrivalsComponent, phase 1B', () => {
  const h = new PageHarness();
  let http: HttpTestingController;

  function setup(rows: ArrivalRow[] = [marie, jean, sophie], role: 'ADMIN' | 'NURSE' | 'PHYSICIAN' | 'RECEPTION' = 'RECEPTION', over: Partial<Arrivals> = {}): ComponentFixture<ArrivalsComponent> {
    const f = h.create('en', ArrivalsComponent, FRONT_DESK_DECLARATIONS, false, {}, role);
    http = h.http;
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    answerList(day(rows, over));
    f.detectChanges();
    return f;
  }

  const lists = (): TestRequest[] => http.match(r => r.method === 'GET' && r.url === `${API}/appointments/arrivals`);
  function answerList(body: Arrivals): void {
    const all = lists();
    expect(all.length).withContext('list requests').toBeGreaterThan(0);
    all[all.length - 1].flush(body);
  }
  const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const box = (f: ComponentFixture<unknown>) => el(f).querySelector<HTMLInputElement>('#arrival-box')!;
  function type(f: ComponentFixture<unknown>, text: string): void {
    box(f).value = text;
    box(f).dispatchEvent(new Event('input'));
    f.detectChanges();
  }
  function key(f: ComponentFixture<unknown>, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    box(f).dispatchEvent(e);
    f.detectChanges();
    return e;
  }
  const enter = (f: ComponentFixture<unknown>) => key(f, 'Enter');
  const search = () => http.expectOne(r => r.method === 'POST' && r.url === `${API}/patients/search`);
  const noPost = (suffix: string) => http.expectNone(r => r.method !== 'GET' && r.url.endsWith(suffix));
  const arrivalOf = (id: number) => http.expectOne(r => r.method === 'POST' && r.url === `${API}/appointments/${id}/arrival`);
  const cardOf = (id: number, method = 'PUT') => http.expectOne(r => r.method === method && r.url === `${API}/patients/${id}/health-card`);
  const activeRow = (f: ComponentFixture<unknown>) => el(f).querySelector('.fd-row.is-active .fd-row__name')?.textContent ?? null;
  const activeItem = (f: ComponentFixture<unknown>) => el(f).querySelector('.fd-found__item.is-active .fd-found__name')?.textContent ?? null;
  const banner = (f: ComponentFixture<unknown>) => el(f).querySelector('.fd-card-banner');

  /** Reads a card: the box empties, Enter sends the search, and the server answers. */
  function scan(f: ComponentFixture<ArrivalsComponent>, answer: PatientSearchResult): void {
    type(f, NAM);
    enter(f);
    search().flush(answer);
    f.detectChanges();
  }

  /** Types a card number the way a scanner does: every key at the same instant, then Enter. */
  function burst(f: ComponentFixture<unknown>, input: HTMLInputElement, text: string): KeyboardEvent {
    for (const ch of text) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
      input.value += ch;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    f.detectChanges();
    return e;
  }

  afterEach(() => {
    document.querySelectorAll('app-arrivals').forEach(n => n.remove());
    try { localStorage.removeItem('aftercare.appts.view'); localStorage.removeItem('aftercare.fd.walkIn'); } catch { /* ignore */ }
  });

  describe('a card number', () => {
    it('is never in the URL, storage, title or console, and the box is empty before the request leaves', () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => spyOn(console, m));
      const f = setup();
      type(f, NAM);
      expect(box(f).value).toBe('');
      enter(f);
      const req = search();
      expect(box(f).value).toBe('');
      expect(req.request.url).not.toContain('ROYS');
      expect(req.request.urlWithParams).not.toContain(NAM_DIGITS);
      expect(req.request.body).toEqual({ healthNumber: NAM });
      req.flush(found({}));
      f.detectChanges();
      expect(location.href).not.toContain('ROYS');
      expect(document.title).not.toContain('ROYS');
      expect(el(f).textContent).not.toContain(NAM_DIGITS);
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          expect(`${store.key(i)}=${store.getItem(store.key(i)!)}`).not.toContain(NAM_DIGITS);
        }
      }
      for (const s of spies) {
        expect(JSON.stringify(s.calls.allArgs())).not.toContain(NAM_DIGITS);
      }
    });

    it('without the HEALTH_CARD_CAPTURE permission says so and sends no request', () => {
      const f = setup();
      (f.componentInstance as unknown as { permissions: { can: (p: string) => boolean } }).permissions.can = (p: string) => p !== 'HEALTH_CARD_CAPTURE';
      type(f, NAM);
      enter(f);
      http.expectNone(r => r.method === 'POST');
      expect(el(f).textContent).toContain('Card search is not allowed for your role');
      expect(f.componentInstance.pendingCard).toBeNull();
    });

    it('is forgotten after 2 minutes', fakeAsync(() => {
      const f = setup();
      type(f, NAM);
      expect(f.componentInstance.pendingCard).not.toBeNull();
      for (let t = 0; t < CARD_TTL_MS; t += 1000) {
        tick(1000);
        for (const r of lists()) { r.flush(day([marie, jean, sophie])); }
      }
      expect(f.componentInstance.pendingCard).toBeNull();
      f.detectChanges();
      expect(box(f).placeholder).toBe('Name or date of birth');
      f.destroy();
      discardPeriodicTasks();
    }));

    it('one match with an appointment today highlights that row, Enter arrives it and records the card as seen', () => {
      const f = setup();
      scan(f, found({ matches: [matchOf(sophie)] }));
      expect(banner(f)!.getAttribute('data-kind')).toBe('recognised');
      expect(activeRow(f)).toBe('Sophie Roy');
      noPost('/arrival');
      enter(f);
      arrivalOf(79).flush(here(sophie));
      const seen = cardOf(14);
      expect(seen.request.body).toEqual({ seen: true });
      expect(JSON.stringify(seen.request.body)).not.toContain('ROYS');
    });

    it('two matches show the banner, highlight nothing and send nothing on Enter', () => {
      const f = setup();
      scan(f, found({ matches: [matchOf(marie), matchOf(sophie)], warnings: ['SHARED_CARD'] }));
      expect(banner(f)!.textContent).toContain('Same card on 2 files');
      expect(activeRow(f)).toBeNull();
      expect(activeItem(f)).toBeNull();
      enter(f);
      http.expectNone(r => r.method === 'POST');
      type(f, 'tr');
      expect(activeItem(f)).toBe('Marie Tremblay'); // two letters, exactly one file
      expect(el(f).querySelectorAll('.fd-found__item:not(.fd-found__new)').length).toBe(1);
    });

    it('two matches: after the letters pick one file, Enter highlights its row and the next Enter arrives it (once)', () => {
      const f = setup();
      scan(f, found({ matches: [matchOf(marie), matchOf(sophie)], warnings: ['SHARED_CARD'] }));
      type(f, 'ro');
      enter(f);
      expect(activeRow(f)).toBe('Sophie Roy');
      http.expectNone(r => r.method === 'POST' && r.url.endsWith('/arrival'));
      enter(f);
      arrivalOf(79).flush(here(sophie));
      enter(f);
      http.expectNone(r => r.method === 'POST' && r.url.endsWith('/arrival'));
    });

    it('the rest of a longer scanner payload after the number is discarded, and its Enter runs the card search', () => {
      const f = setup();
      type(f, NAM);
      for (const ch of 'TREMBLAY MARIE 1968') {
        type(f, ch); // the scanner keeps typing into the emptied box, one character at a time: never kept
        expect(box(f).value).toBe('');
      }
      expect(el(f).textContent).not.toContain('TREMBLAY');
      enter(f);
      const req = search();
      expect(req.request.body).toEqual({ healthNumber: NAM });
      req.flush(found({ matches: [matchOf(sophie)] }));
    });

    it('candidates are never pre-highlighted; fewer than 2 letters, or letters matching two of them, send nothing', () => {
      const f = setup();
      scan(f, found({ candidates: [stranger(30, 'Luc', 'Royer'), stranger(31, 'Anne', 'Royal')] }));
      expect(banner(f)!.getAttribute('data-kind')).toBe('candidates');
      expect(activeRow(f)).toBeNull();
      expect(activeItem(f)).toBeNull();
      enter(f);
      type(f, 'r');
      enter(f);
      expect(activeItem(f)).toBeNull();
      type(f, 'ro'); // matches both Royer and Royal
      expect(activeItem(f)).toBeNull();
      enter(f);
      http.expectNone(r => r.method === 'PUT' || (r.method === 'POST' && r.url !== `${API}/patients/search`));
      type(f, 'roye');
      expect(activeItem(f)).toBe('Luc Royer');
    });

    it('Enter on the one candidate the letters point at attaches the card (a body, never a URL), then notes the arrival', () => {
      const f = setup();
      scan(f, found({ candidates: [matchOf(marie), stranger(31, 'Anne', 'Royal')] }));
      type(f, 'tr');
      enter(f);
      const put = cardOf(12);
      expect(put.request.body).toEqual({ healthNumber: NAM });
      expect(put.request.urlWithParams).not.toContain(NAM_DIGITS);
      put.flush({ card: F.card({ status: 'UNKNOWN', expiry: null }), warnings: [] });
      arrivalOf(77).flush(here(marie));
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toContain('Arrival of Marie T. recorded · card added');
      expect(f.componentInstance.pendingCard).toBeNull();
    });

    it('HEALTH_NUMBER_MISMATCH sends no arrival; Enter on the banner then sends exactly one arrival and no card call', () => {
      const f = setup();
      scan(f, found({ candidates: [matchOf(marie), stranger(31, 'Anne', 'Royal')] }));
      type(f, 'tr');
      enter(f);
      cardOf(12).flush(apiError(409, 'HEALTH_NUMBER_MISMATCH', 'A different health number is on file'), { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      noPost('/arrival');
      expect(banner(f)!.getAttribute('data-kind')).toBe('mismatch');
      expect(banner(f)!.textContent).toContain('Note the arrival without the card (Enter)');
      enter(f);
      arrivalOf(77).flush(here(marie));
      http.expectNone(r => r.url.endsWith('/health-card'));
    });

    it('HEALTH_NUMBER_IN_USE lists the other file with « Use this file »; the infant reason shows only for a child under one year', () => {
      const f = setup();
      const baby = F.deskPatient({ id: 14, firstName: 'Sophie', lastName: 'Roy', dateOfBirth: new Date().toISOString().slice(0, 4) + '-01-01', card: F.card({ onFile: false, status: 'NONE', expiry: null }) });
      scan(f, found({ candidates: [F.patientMatch({ patient: baby, todayAppointments: [appt(79, sophie.scheduledAt)] })] }));
      type(f, 'ro');
      enter(f);
      cardOf(14).flush(apiError(409, 'HEALTH_NUMBER_IN_USE', '', { candidates: [matchOf(marie)] }), { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      expect(banner(f)!.getAttribute('data-kind')).toBe('inUse');
      expect(el(f).querySelector('.fd-use-result')!.textContent).toContain('Use this file');
      expect(el(f).querySelector('.fd-reason-infant')).not.toBeNull();
      expect(el(f).querySelector('.fd-reason-other')).toBeNull(); // reception has no CLINICAL_WRITE
      el(f).querySelector<HTMLButtonElement>('.fd-reason-infant')!.click();
      const retry = cardOf(14);
      expect(retry.request.body).toEqual({ healthNumber: NAM, sharedCardReason: 'PARENT_CARD_CHILD_UNDER_1' });
    });

    it('no match and no candidate says so; Enter on a row whose card is not on file attaches the card', () => {
      const noCard = F.arrivalRow({ appointmentId: 80, scheduledAt: '2026-10-14T09:00:00', patient: F.deskPatient({ id: 15, firstName: 'Paul', lastName: 'Sansnam', card: F.card({ onFile: false, status: 'NONE', expiry: null }) }) });
      const f = setup([marie, noCard]);
      scan(f, found({}));
      expect(banner(f)!.textContent).toContain('No file with this card. Type the name, or create the file.');
      type(f, 'sans');
      enter(f);
      expect(cardOf(15).request.body).toEqual({ healthNumber: NAM });
    });

    it('no match and no candidate highlights « New patient »; typing a name drops it, an empty box brings it back (§11.8 step 8)', fakeAsync(() => {
      const noCard = F.arrivalRow({ appointmentId: 80, scheduledAt: '2026-10-14T09:00:00', patient: F.deskPatient({ id: 15, firstName: 'Paul', lastName: 'Sansnam', card: F.card({ onFile: false, status: 'NONE', expiry: null }) }) });
      const f = setup([marie, noCard]);
      scan(f, found({}));
      expect(el(f).querySelector('.fd-found__new.is-active')).not.toBeNull();
      type(f, 'sans');
      expect(el(f).querySelector('.fd-found__new.is-active')).toBeNull();
      type(f, '');
      expect(el(f).querySelector('.fd-found__new.is-active')).not.toBeNull();
      enter(f);
      tick();
      f.detectChanges();
      expect(el(f).querySelector('.drawer')).not.toBeNull();
      noPost('/health-card');
      f.destroy();
      discardPeriodicTasks();
    }));

    it('a row whose card is already on file is only arrived (the card is never overwritten)', () => {
      const f = setup([marie, jean]);
      scan(f, found({}));
      type(f, 'trem');
      enter(f);
      arrivalOf(77).flush(here(marie));
      http.expectNone(r => r.url.endsWith('/health-card'));
    });

    it('429 on a card search says so under the box and keeps the name path open', () => {
      const f = setup();
      type(f, NAM);
      enter(f);
      search().flush(apiError(429, 'RATE_LIMITED', 'Too many card lookups; search by name', { retryAfterSeconds: 90 }), { status: 429, statusText: 'Too Many Requests' });
      f.detectChanges();
      expect(el(f).querySelector('.fd-hint--limit')!.textContent).toBe('Too many card searches. Continue with the name.');
      type(f, 'jean');
      expect(activeRow(f)).toBe('Jean-François Gagnon');
    });

    it('focus() is only ever called on the box in a whole card-and-arrival flow', () => {
      const targets: string[] = [];
      const f = setup();
      spyOn(HTMLElement.prototype, 'focus').and.callFake(function (this: HTMLElement) { targets.push(this.id || this.tagName); });
      scan(f, found({ matches: [matchOf(sophie)] }));
      enter(f);
      arrivalOf(79).flush(here(sophie));
      f.detectChanges();
      expect(targets.length).toBeGreaterThan(0);
      expect(new Set(targets)).toEqual(new Set(['arrival-box']));
    });
  });

  describe('scan guard', () => {
    function openDrawer(f: ComponentFixture<ArrivalsComponent>): void {
      type(f, 'zzzq');
      enter(f);
      search().flush(found({ mode: 'NAME' }));
      f.detectChanges();
      enter(f); // the « New patient » item is highlighted
      f.detectChanges();
    }

    it('a burst typed into « First name » of the open drawer submits nothing, restores the field and shows « Card read ✓ »', () => {
      const f = setup();
      openDrawer(f);
      const first = el(f).querySelector<HTMLInputElement>('#fd-q-first')!;
      first.value = '';
      const e = burst(f, first, NAM);
      expect(e.defaultPrevented).toBeTrue();
      f.detectChanges();
      expect(first.value).toBe('');
      expect(el(f).querySelector('.fd-quick__cardread')!.textContent!.trim()).toBe('✓ Card read'); // one glyph, not « ✓ Card read ✓ »
      http.expectNone(r => r.method === 'POST' && r.url.endsWith('/patients/quick'));
      expect(f.componentInstance.pendingCard?.nam).toBe(NAM);
    });

    it('a burst into the expiry field of a fix panel likewise: field restored, number to the box flow', () => {
      const expired = F.arrivalRow({ desk: { state: 'GO', reasons: ['CARD_EXPIRED'], notices: [] }, patient: F.deskPatient({ card: F.card({ status: 'EXPIRED', expiry: '2026-01' }) }) });
      const f = setup([expired, jean]);
      f.componentInstance.expandedId = 77;
      f.detectChanges();
      const input = el(f).querySelector<HTMLInputElement>('.fd-expiry')!;
      expect(input).not.toBeNull();
      const e = burst(f, input, NAM);
      expect(e.defaultPrevented).toBeTrue();
      expect(input.value).toBe('');
      http.expectNone(r => r.method !== 'GET');
      expect(f.componentInstance.pendingCard?.nam).toBe(NAM);
    });

    it('a person typing at normal speed is never treated as a scanner', () => {
      const f = setup();
      openDrawer(f);
      const first = el(f).querySelector<HTMLInputElement>('#fd-q-first')!;
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      first.value = 'a';
      const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      first.dispatchEvent(e);
      expect(e.defaultPrevented).toBeFalse();
    });
  });

  describe('expiry answer in the box', () => {
    function arrivedWithCard(f: ComponentFixture<ArrivalsComponent>): void {
      scan(f, found({ matches: [matchOf(sophie)] }));
      enter(f);
      arrivalOf(79).flush(here(sophie));
      cardOf(14).flush({ card: F.card(), warnings: [] });
      f.detectChanges();
    }

    it('the toast asks for it, echoes what is typed, and Enter sends it for that patient', () => {
      const f = setup();
      arrivedWithCard(f);
      expect(el(f).querySelector('.fd-toast')!.textContent).toContain('Expiry? Type it, then Enter');
      type(f, '0327');
      expect(el(f).querySelector('.fd-toast')!.textContent).toContain('→ expires March 2027, Sophie R.');
      enter(f);
      const put = cardOf(14);
      expect(put.request.body).toEqual({ cardExpiry: '2027-03' });
      put.flush({ card: F.card(), warnings: [] });
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toContain('Expiry saved');
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toContain('✓ Card on file'); // §11.8 step 5
    });

    it('« 1103 » is refused with « Check the year » and sends nothing', () => {
      const f = setup();
      arrivedWithCard(f);
      type(f, '1103');
      expect(el(f).querySelector('.fd-toast')!.textContent).toContain('Check the year');
      enter(f);
      http.expectNone(r => r.url.endsWith('/health-card'));
    });

    it('after the toast is gone the same text is a phone search', fakeAsync(() => {
      const f = setup();
      arrivedWithCard(f);
      for (let t = 0; t < ASK_TOAST_MS + 1000; t += 1000) {
        tick(1000);
        for (const r of lists()) { r.flush(day([marie, jean, here(sophie)])); }
        f.detectChanges();
      }
      expect(el(f).querySelector('.fd-toast')).toBeNull();
      type(f, '0327');
      enter(f);
      expect(search().request.body).toEqual({ phoneDigits: '0327' });
      f.destroy();
      discardPeriodicTasks();
    }));
  });

  describe('search over all files', () => {
    it('a name with no local row is searched on Enter; the first result is highlighted and Enter opens its panel, never a walk-in', () => {
      const f = setup();
      type(f, 'zzzq');
      expect(el(f).textContent).toContain('Enter: search all files');
      enter(f);
      const req = search();
      expect(req.request.body).toEqual({ query: 'zzzq' });
      req.flush(found({ mode: 'NAME', matches: [stranger(40, 'Zzz-Test', 'Zzzq')] }));
      f.detectChanges();
      expect(activeItem(f)).toBe('Zzz-Test Zzzq');
      enter(f);
      expect(el(f).querySelector('.fd-result-panel')).not.toBeNull();
      http.expectNone(r => r.url.endsWith('/walk-in'));
    });

    it('a text whose only row is already here: the first Enter says so, the second searches every file (§11.8 step 16)', () => {
      const f = setup([here(marie), jean]);
      type(f, 'trem');
      enter(f);
      http.expectNone(r => r.method === 'POST' && r.url.endsWith('/patients/search'));
      expect(el(f).querySelector('.fd-search-all')).not.toBeNull();
      enter(f);
      expect(search().request.body).toEqual({ query: 'trem' });
    });

    it('a result whose appointment today is already arrived says « Already here » and its row stays listed (§11.8 step 7)', () => {
      const f = setup([marie, here(jean)]);
      type(f, '0102');
      enter(f);
      search().flush(found({ mode: 'PHONE', matches: [F.patientMatch({ patient: jean.patient, todayAppointments: [appt(78, jean.scheduledAt, true)] })] }));
      f.detectChanges();
      expect(el(f).querySelector('.fd-found__item')!.textContent).toContain('Already here');
      expect(el(f).querySelector('.fd-row[data-appt="78"]')).not.toBeNull();
      enter(f);
      noPost('/arrival');
    });

    it('a date goes as dateOfBirth and 4 to 10 digits as phoneDigits', () => {
      const f = setup();
      type(f, '1990-02-03');
      enter(f);
      expect(search().request.body).toEqual({ dateOfBirth: '1990-02-03' });
      type(f, '514 555 0199');
      enter(f);
      expect(search().request.body).toEqual({ phoneDigits: '5145550199' });
    });

    it('a result with an appointment today moves the highlight to its row; a second Enter arrives it', () => {
      const f = setup();
      type(f, 'zzzq');
      enter(f);
      search().flush(found({ mode: 'PHONE', matches: [matchOf(jean)] }));
      f.detectChanges();
      enter(f);
      expect(activeRow(f)).toBe('Jean-François Gagnon');
      noPost('/arrival');
      enter(f);
      arrivalOf(78).flush(here(jean));
    });

    it('429 on a name search says when to try again', () => {
      const f = setup();
      type(f, 'zzzq');
      enter(f);
      search().flush(apiError(429, 'RATE_LIMITED', 'Too many searches; try again later', { retryAfterSeconds: 120 }), { status: 429, statusText: 'Too Many Requests' });
      f.detectChanges();
      expect(el(f).querySelector('.fd-hint--limit')!.textContent).toBe('Too many searches. Try again in 2 min.');
    });
  });

  describe('walk-in', () => {
    function toWalkIn(f: ComponentFixture<ArrivalsComponent>): void {
      type(f, 'zzzq');
      enter(f);
      search().flush(found({ mode: 'NAME', matches: [stranger(40, 'Zzz-Test', 'Zzzq')] }));
      f.detectChanges();
      enter(f);
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-walkin-btn')!.click();
      f.detectChanges();
    }
    const walkInRow = F.arrivalRow({
      appointmentId: 90, walkIn: true, questionnaire: 'NONE', status: 'SCHEDULED', patient: F.deskPatient({ id: 40, firstName: 'Zzz-Test', lastName: 'Zzzq' }),
      arrival: { arrivedAt: '2026-10-14T13:30:00Z', source: 'DESK', byName: 'Dev Reception' }, desk: { state: 'ARRIVED', reasons: [], notices: [] }
    });

    it('says « No questionnaire for this choice » for an unmapped pair only', () => {
      const f = setup([marie], 'RECEPTION', { walkInOptions: [] });
      toWalkIn(f);
      expect(el(f).querySelector('.fd-walkin__noq')!.textContent).toContain('No questionnaire for this choice');
    });

    it('Enter with an empty box creates the visit; the placeholder says so', () => {
      const f = setup([marie], 'RECEPTION', { walkInOptions: [{ type: 'GENERAL_CONSULT', specialty: 'ORTHOPEDIC_SURGERY' }] });
      toWalkIn(f);
      expect(el(f).querySelector('.fd-walkin__noq')).toBeNull();
      expect(box(f).placeholder).toBe('Enter: create the visit');
      expect(el(f).querySelector('.fd-hint--walkin')!.textContent).toContain('Tab: change the visit type');
      enter(f);
      const req = http.expectOne(r => r.method === 'POST' && r.url === `${API}/appointments/walk-in`);
      expect(req.request.body).toEqual({ patientId: 40, type: 'GENERAL_CONSULT', specialty: 'ORTHOPEDIC_SURGERY' });
      req.flush(walkInRow);
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toContain('Visit of Zzz-Test Z. created without appointment');
    });

    it('Ctrl+Z on the toast calls walk-in/undo', () => {
      const f = setup([marie], 'RECEPTION', { walkInOptions: [] });
      toWalkIn(f);
      enter(f);
      http.expectOne(r => r.url === `${API}/appointments/walk-in`).flush(walkInRow);
      f.detectChanges();
      key(f, 'z', { ctrlKey: true });
      http.expectOne(r => r.method === 'POST' && r.url === `${API}/appointments/90/walk-in/undo`).flush({ result: 'REMOVED' });
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toContain('Visit removed');
    });
  });

  describe('quick patient', () => {
    function open(f: ComponentFixture<ArrivalsComponent>, text = 'zzz-test arrivee'): void {
      tick(); // the page's own initial focus timer
      type(f, text);
      enter(f);
      search().flush(found({ mode: 'NAME' }));
      f.detectChanges();
      enter(f);
      f.detectChanges();
      tick();
      f.detectChanges();
      tick();
      f.detectChanges();
    }
    const field = (f: ComponentFixture<unknown>, sel: string) => el(f).querySelector<HTMLInputElement>(sel)!;
    function fill(f: ComponentFixture<unknown>, sel: string, v: string): void {
      const i = field(f, sel);
      i.value = v;
      i.dispatchEvent(new Event('input'));
      f.detectChanges();
    }
    const submit = (f: ComponentFixture<unknown>) => { el(f).querySelector<HTMLButtonElement>('.fd-quick-submit')!.click(); f.detectChanges(); };
    const quick = () => http.expectOne(r => r.method === 'POST' && r.url === `${API}/patients/quick`);
    const done = (f: ComponentFixture<ArrivalsComponent>) => { f.destroy(); discardPeriodicTasks(); };

    it('opens with the first field focused; three fields and the button send the body; the result panel opens', fakeAsync(() => {
      const f = setup();
      open(f);
      expect(field(f, '#fd-q-first').value).toBe('zzz-test');
      expect(field(f, '#fd-q-last').value).toBe('arrivee');
      expect(document.activeElement).toBe(field(f, '#fd-q-first'));
      fill(f, '#fd-q-dob', '2019-06-03');
      submit(f);
      const req = quick();
      expect(req.request.body).toEqual({ firstName: 'zzz-test', lastName: 'arrivee', dateOfBirth: '2019-06-03' });
      req.flush({ patient: F.deskPatient({ id: 40, firstName: 'zzz-test', lastName: 'arrivee' }), warnings: [] });
      f.detectChanges();
      expect(el(f).querySelector('.drawer')).toBeNull();
      expect(el(f).querySelector('.fd-result-panel')).not.toBeNull();
      expect(document.activeElement).toBe(box(f));
      done(f);
    }));

    it('« ⇄ » swaps first and last name', fakeAsync(() => {
      const f = setup();
      open(f);
      el(f).querySelector<HTMLButtonElement>('.fd-swap')!.click();
      tick();
      f.detectChanges();
      tick();
      f.detectChanges();
      expect(field(f, '#fd-q-first').value).toBe('arrivee');
      expect(field(f, '#fd-q-last').value).toBe('zzz-test');
      done(f);
    }));

    it('409 shows the candidates with « Use this file » focused; « Create anyway » re-sends with confirmNew', fakeAsync(() => {
      const f = setup();
      open(f);
      fill(f, '#fd-q-dob', '2019-06-03');
      submit(f);
      quick().flush(apiError(409, 'POSSIBLE_DUPLICATE', '', { candidates: [matchOf(jean)] }), { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      tick();
      f.detectChanges();
      expect(document.activeElement).toBe(el(f).querySelector('.fd-use-file'));
      el(f).querySelector<HTMLButtonElement>('.fd-create-anyway')!.click();
      f.detectChanges();
      expect(quick().request.body).toEqual(jasmine.objectContaining({ confirmNew: true }));
      done(f);
    }));

    it('after « Create anyway », the infant reason on HEALTH_NUMBER_IN_USE still sends confirmNew (one click, not two)', fakeAsync(() => {
      const f = setup();
      open(f);
      fill(f, '#fd-q-dob', '2026-08-01');
      submit(f);
      quick().flush(apiError(409, 'POSSIBLE_DUPLICATE', '', { candidates: [matchOf(jean)] }), { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      tick();
      el(f).querySelector<HTMLButtonElement>('.fd-create-anyway')!.click();
      f.detectChanges();
      quick().flush(apiError(409, 'HEALTH_NUMBER_IN_USE', '', { candidates: [matchOf(jean)] }), { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      tick();
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-reason-infant')!.click();
      f.detectChanges();
      expect(quick().request.body).toEqual(jasmine.objectContaining({ confirmNew: true, sharedCardReason: 'PARENT_CARD_CHILD_UNDER_1' }));
      done(f);
    }));

    it('« Another child of the same parent » sends copyContactFrom', fakeAsync(() => {
      const f = setup();
      open(f);
      fill(f, '#fd-q-dob', '2019-06-03');
      submit(f);
      quick().flush({ patient: F.deskPatient({ id: 40, firstName: 'Léa', lastName: 'Tremblay' }), warnings: [] });
      f.detectChanges();
      f.componentInstance.openQuick();
      f.detectChanges();
      tick();
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-same-parent')!.click();
      tick();
      f.detectChanges();
      expect(el(f).querySelector('.fd-quick__copied')!.textContent).toContain('Contact details copied from Léa Tremblay');
      fill(f, '#fd-q-first', 'Noah');
      fill(f, '#fd-q-dob', '2021-02-02');
      submit(f);
      expect(quick().request.body).toEqual(jasmine.objectContaining({ firstName: 'Noah', lastName: 'Tremblay', copyContactFrom: 40 }));
      done(f);
    }));

    it('Enter on a consent button keeps that answer and submits (§11.8 step 9: « Oui », then Enter)', fakeAsync(() => {
      const f = setup();
      open(f);
      fill(f, '#fd-q-dob', '1990-01-15');
      fill(f, '#fd-q-phone', '514-555-0142');
      tick();
      f.detectChanges();
      const yes = el(f).querySelector<HTMLButtonElement>('.fd-consent-yes')!;
      yes.click();
      f.detectChanges();
      yes.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      f.detectChanges();
      expect(quick().request.body).toEqual(jasmine.objectContaining({ phone: '514-555-0142', contactConsent: 'GRANTED' }));
      done(f);
    }));

    it('a card read before opens with « Card read ✓ », the date from the card, and sends the number in the body only', fakeAsync(() => {
      const f = setup();
      tick();
      type(f, NAM);
      enter(f);
      search().flush(found({}));
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-new-patient')!.click();
      tick();
      f.detectChanges();
      tick();
      f.detectChanges();
      expect(el(f).querySelector('.fd-quick__cardread')!.textContent!.trim()).toBe('✓ Card read'); // one glyph, not « ✓ Card read ✓ »
      expect(el(f).querySelector('.drawer')!.textContent).not.toContain(NAM_DIGITS);
      expect(field(f, '#fd-q-dob').value).toBe('1985-02-27');
      fill(f, '#fd-q-first', 'Sophie');
      fill(f, '#fd-q-last', 'Roy');
      submit(f);
      expect(quick().request.body).toEqual(jasmine.objectContaining({ healthNumber: NAM, dateOfBirth: '1985-02-27' }));
      done(f);
    }));

    it('Escape closes the drawer and gives the focus back to the box', fakeAsync(() => {
      const f = setup();
      open(f);
      field(f, '#fd-q-first').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      f.detectChanges();
      expect(el(f).querySelector('.drawer')).toBeNull();
      expect(document.activeElement).toBe(box(f));
      done(f);
    }));
  });

  describe('family arrivals and undo', () => {
    it('the toast adds « Also: … »; Enter with an empty box arrives them; Ctrl+Z undoes all of them', () => {
      const f = setup();
      type(f, 'trem');
      enter(f);
      arrivalOf(77).flush(here(marie));
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast')!.textContent).toContain('Also: Jean-François (14:30), Sophie (16:00) — Enter to note their arrival');
      enter(f);
      const a = arrivalOf(78);
      const b = arrivalOf(79);
      a.flush(here(jean));
      b.flush(here(sophie));
      f.detectChanges();
      key(f, 'z', { ctrlKey: true });
      const undone = http.match(r => r.method === 'DELETE' && r.url.endsWith('/arrival')).map(r => r.request.url.split('/').slice(-2)[0]).sort();
      expect(undone).toEqual(['78', '79']);
    });

    it('a row chosen with the arrows wins over the « Also: … » prompt: Enter arrives only that row', () => {
      const f = setup();
      type(f, 'trem');
      enter(f);
      arrivalOf(77).flush(here(marie));
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast')!.textContent).toContain('Also:');
      key(f, 'ArrowDown');
      const chosen = activeRow(f);
      expect(chosen).not.toBeNull();
      enter(f);
      const posts = http.match(r => r.method === 'POST' && r.url.endsWith('/arrival'));
      expect(posts.length).toBe(1);
    });

    it('one refused family arrival keeps the others undoable', () => {
      const f = setup();
      type(f, 'trem');
      enter(f);
      arrivalOf(77).flush(here(marie));
      f.detectChanges();
      enter(f);
      arrivalOf(78).flush(here(jean));
      arrivalOf(79).flush(apiError(409, 'INVALID_STATE', 'closed'), { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      key(f, 'z', { ctrlKey: true });
      const undone = http.match(r => r.method === 'DELETE' && r.url.endsWith('/arrival')).map(r => r.request.url.split('/').slice(-2)[0]);
      expect(undone).toEqual(['78']);
    });

    it('an arrival that also attached a card is undone with DELETE …/arrival and DELETE …/health-card', () => {
      const f = setup();
      scan(f, found({ candidates: [matchOf(marie), stranger(31, 'Anne', 'Royal')] }));
      type(f, 'tr');
      enter(f);
      cardOf(12).flush({ card: F.card(), warnings: [] });
      arrivalOf(77).flush(here(marie));
      f.detectChanges();
      key(f, 'z', { ctrlKey: true });
      http.expectOne(r => r.method === 'DELETE' && r.url === `${API}/appointments/77/arrival`);
      http.expectOne(r => r.method === 'DELETE' && r.url === `${API}/patients/12/health-card`);
    });
  });
});
