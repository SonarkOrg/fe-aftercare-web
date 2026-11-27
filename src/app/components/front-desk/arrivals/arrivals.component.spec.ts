import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ArrivalRow, Arrivals } from '../../../models/arrival.model';
import * as F from '../../../testing/fixtures';
import { PageHarness } from '../../../testing/page-harness';
import { FD_IDLE_MS } from '../fd-idle';
import { FRONT_DESK_DECLARATIONS } from '../front-desk.testing';
import { TOAST_MS } from '../undo-toast/undo-toast.component';
import { ArrivalsComponent, POLL_MS } from './arrivals.component';

const API = environment.apiUrl;
const NAM = 'ROYS85522712';

const marie = F.arrivalRow();
const jean = F.arrivalRow({
  appointmentId: 78, scheduledAt: '2026-10-14T14:30:00', status: 'SCHEDULED', questionnaire: 'MISSING',
  patient: F.deskPatient({ id: 13, firstName: 'Jean-François', lastName: 'Gagnon', dateOfBirth: '1985-02-03', ageYears: 41, contactConsent: 'GRANTED' }),
  desk: { state: 'CHECK', reasons: ['QUESTIONNAIRE_MISSING'], notices: [] }
});
const sophie = F.arrivalRow({
  appointmentId: 79, scheduledAt: '2026-10-14T16:00:00', status: 'SCHEDULED', questionnaire: 'MISSING',
  patient: F.deskPatient({ id: 14, firstName: 'Sophie', lastName: 'Roy', dateOfBirth: '1990-01-15', ageYears: 36, contactConsent: 'UNKNOWN' }),
  desk: { state: 'CHECK', reasons: ['QUESTIONNAIRE_MISSING'], notices: ['CONSENT_UNKNOWN'] }
});
const done = F.arrivalRow({ appointmentId: 80, scheduledAt: '2026-10-14T08:00:00', status: 'COMPLETED', patient: F.deskPatient({ id: 15, firstName: 'Paul', lastName: 'Closed', dateOfBirth: '1970-01-01' }), desk: { state: 'CLOSED', reasons: [], notices: [] } });
const here = (r: ArrivalRow, at = '2026-10-14T13:21:00Z'): ArrivalRow => ({ ...r, arrival: { arrivedAt: at, source: 'DESK', byName: 'Dev Reception' }, desk: { state: 'ARRIVED', reasons: [], notices: [] } });
const day = (rows: ArrivalRow[], over: Partial<Arrivals> = {}): Arrivals => F.arrivals({ rows, ...over });

describe('ArrivalsComponent', () => {
  const h = new PageHarness();
  let http: HttpTestingController;

  function setup(rows: ArrivalRow[] = [marie, jean, sophie, done], role: 'ADMIN' | 'NURSE' | 'PHYSICIAN' | 'RECEPTION' = 'RECEPTION', over: Partial<Arrivals> = {}, lang: 'en' | 'fr' = 'en') {
    const f: ComponentFixture<ArrivalsComponent> = h.create(lang, ArrivalsComponent, FRONT_DESK_DECLARATIONS, false, {}, role);
    http = h.http;
    document.body.appendChild(f.nativeElement); // the focus rules need the page in the document
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
  const names = (f: ComponentFixture<unknown>, group?: string) =>
    Array.from(el(f).querySelectorAll(group ? `[data-group="${group}"] .fd-row__name` : '.fd-row__name')).map(n => n.textContent);
  const postArrival = (id: number) => http.expectOne(r => r.method === 'POST' && r.url === `${API}/appointments/${id}/arrival`);
  const deleteArrival = (id: number) => http.expectOne(r => r.method === 'DELETE' && r.url === `${API}/appointments/${id}/arrival`);
  const active = (f: ComponentFixture<unknown>) => el(f).querySelector('.fd-row.is-active .fd-row__name')?.textContent ?? null;

  /** Lets time pass in poll-sized steps and answers every poll on the way, as a healthy server would. */
  function tickAnswering(ms: number, rows: ArrivalRow[] = [marie, jean, sophie, done]): void {
    for (let t = 0; t < ms; t += 1000) {
      tick(1000);
      for (const r of lists()) {
        r.flush(day(rows));
      }
    }
  }

  afterEach(() => {
    document.querySelectorAll('app-arrivals').forEach(n => n.remove());
    try { localStorage.removeItem('aftercare.appts.view'); } catch { /* ignore */ }
  });

  describe('layout', () => {
    it('shows the title, four KPIs, three groups with the closed one collapsed, and the first row highlighted', () => {
      const f = setup();
      expect(el(f).querySelector('h1')!.textContent).toBe('Arrivals');
      expect(Array.from(el(f).querySelectorAll('.fd-kpis .kpi')).map(k => k.querySelector('.kpi__value')!.textContent)).toEqual(['3', '2', '0', '0']);
      expect(names(f, 'expected')).toEqual(['Marie Tremblay', 'Jean-François Gagnon', 'Sophie Roy']);
      expect(names(f, 'closed')).toEqual(['Paul Closed']);
      expect(el(f).querySelector('details[data-group=closed]')!.hasAttribute('open')).toBeFalse();
      expect(el(f).querySelector('[data-group=here]')).toBeNull();
      expect(active(f)).toBe('Marie Tremblay');
      expect(el(f).querySelector('.fd-row.is-active')!.getAttribute('aria-current')).toBe('true');
      expect(el(f).querySelector('.hero__sub')!.textContent).toContain('updated at 09:41');
    });

    it('arrived rows go to "Here", latest arrival first', () => {
      const f = setup([here(marie, '2026-10-14T13:00:00Z'), here(jean, '2026-10-14T14:00:00Z'), sophie]);
      expect(names(f, 'here')).toEqual(['Jean-François Gagnon', 'Marie Tremblay']);
      expect(names(f, 'expected')).toEqual(['Sophie Roy']);
    });

    it('the view links are anchors, the arrivals one is the current page, and nothing is aria-pressed', () => {
      const f = setup();
      expect(el(f).querySelector('#view-day')!.tagName).toBe('A');
      expect(el(f).querySelector('#view-week')!.tagName).toBe('A');
      expect(el(f).querySelector('#view-arrivals')!.getAttribute('aria-current')).toBe('page');
      expect(el(f).querySelector('.fd-views [aria-pressed]')).toBeNull();
    });

    it('with no appointment today shows the empty state', () => {
      const f = setup([]);
      expect(el(f).querySelector('.card.empty')!.textContent).toContain('No appointments today');
    });

    it('remembers the view in localStorage, and works when storage throws', () => {
      setup();
      expect(localStorage.getItem('aftercare.appts.view')).toBe('arrivals');
      TestBed.resetTestingModule();
      spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
      const f = setup();
      expect(names(f).length).toBe(4);
    });

    it('first-load failure shows an error with a retry that works', () => {
      const f: ComponentFixture<ArrivalsComponent> = h.create('en', ArrivalsComponent, FRONT_DESK_DECLARATIONS, false, {}, 'RECEPTION');
      http = h.http;
      document.body.appendChild(f.nativeElement);
      f.detectChanges();
      expect(el(f).querySelectorAll('.skeleton--kpi').length).toBe(4);
      expect(el(f).querySelectorAll('.skeleton--row').length).toBe(5);
      lists()[0].flush({}, { status: 500, statusText: 'x' });
      f.detectChanges();
      expect(el(f).querySelector('.banner--error')!.textContent).toContain('The list could not be loaded.');
      el(f).querySelector<HTMLButtonElement>('.fd-retry')!.click();
      answerList(day([marie]));
      f.detectChanges();
      expect(names(f)).toEqual(['Marie Tremblay']);
      expect(el(f).querySelector('.banner--error')).toBeNull();
    });

    it('another day is read-only: no arrive buttons and the banner says so', () => {
      const f = setup([marie], 'RECEPTION', { today: false });
      expect(el(f).querySelector('.fd-arrive')).toBeNull();
      expect(el(f).textContent).toContain('Arrivals are recorded on the day itself.');
      key(f, 'Enter');
      http.verify();
    });

    for (const role of ['RECEPTION', 'NURSE', 'PHYSICIAN', 'ADMIN'] as const) {
      it(`the box and the arrive buttons are visible for ${role}`, () => {
        const f = setup([marie], role);
        expect(box(f)).not.toBeNull();
        expect(el(f).querySelector('#arrive-77')).not.toBeNull();
      });
    }
  });

  describe('typing', () => {
    it('filters rows by name with no request and highlights the first match with the birth date', () => {
      const f = setup();
      type(f, 'trem');
      expect(names(f)).toEqual(['Marie Tremblay']);
      expect(active(f)).toBe('Marie Tremblay');
      expect(el(f).querySelector('.fd-row__dob')!.textContent).toContain('12 Apr 1968');
      http.verify();
    });

    it('finds a compound first name by "jean fr" and by a date of birth in any accepted form', () => {
      const f = setup();
      type(f, 'jean fr');
      expect(names(f)).toEqual(['Jean-François Gagnon']);
      for (const q of ['12/04/1968', '12041968', '1968-04-12']) {
        type(f, q);
        expect(names(f)).withContext(q).toEqual(['Marie Tremblay']);
      }
      http.verify();
    });

    it('the arrow keys move the highlight across visible rows (no wrap)', () => {
      const f = setup();
      key(f, 'ArrowDown');
      expect(active(f)).toBe('Jean-François Gagnon');
      key(f, 'ArrowDown');
      key(f, 'ArrowDown');
      expect(active(f)).toBe('Sophie Roy');
      key(f, 'ArrowUp');
      expect(active(f)).toBe('Jean-François Gagnon');
      expect(el(f).querySelector('#fd-selection')!.textContent).toBe('Selected: Jean-François Gagnon, 14:30, To check');
    });

    it('a filter with no local row says so, echoes the text and offers the search over all files', () => {
      const f = setup();
      type(f, 'zzzq');
      expect(el(f).querySelector('.fd-nomatch .empty__title')!.textContent).toBe('No appointment today for "zzzq".');
      expect(el(f).querySelector<HTMLAnchorElement>('.fd-nomatch a')!.getAttribute('href')).toBe('/patients?q=zzzq');
    });

    it('never echoes or links a text that looks like the start of a health number', () => {
      const f = setup();
      type(f, 'ROYS8552');
      expect(el(f).querySelector('.fd-nomatch .empty__title')!.textContent).toBe('No appointment today matches.');
      expect(el(f).querySelector('.fd-nomatch a')).toBeNull();
      expect(el(f).querySelector('.fd-nomatch')!.innerHTML).not.toContain('ROYS8552');
      expect(el(f).textContent).not.toContain('ROYS8552');
    });

    it('an empty box with no arrow movement does not let Enter arrive the first row by accident', () => {
      const f = setup();
      key(f, 'Enter');
      http.verify();
      key(f, 'ArrowDown');
      key(f, 'Enter');
      postArrival(78).flush(here(jean));
    });
  });

  describe('arriving and undoing', () => {
    it('Enter arrives the highlighted row with one POST, moves it to "Here", shows the toast, empties and focuses the box', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      f.detectChanges();
      expect(names(f, 'here')).toEqual(['Marie Tremblay']);
      expect(names(f, 'expected')).toEqual(['Jean-François Gagnon', 'Sophie Roy']);
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toBe('Arrival of Marie T. recorded');
      expect(el(f).querySelector('#fd-live')!.textContent).toBe('Arrival of Marie Tremblay recorded');
      expect(box(f).value).toBe('');
      expect(document.activeElement).toBe(box(f));
      expect(Array.from(el(f).querySelectorAll('.fd-kpis .kpi__value')).map(k => k.textContent)).toEqual(['2', '2', '1', '0']);
      answerList(day([here(marie), jean, sophie, done])); // the refresh after the action
      http.verify();
    });

    it('the toast goes away after six seconds', fakeAsync(() => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      f.detectChanges();
      answerList(day([here(marie), jean, sophie, done]));
      expect(el(f).querySelector('.fd-toast')).not.toBeNull();
      tick(TOAST_MS);
      f.detectChanges();
      expect(el(f).querySelector('.fd-toast')).toBeNull();
      f.destroy();
      flush();
    }));

    it('Ctrl+Z with an empty box deletes the arrival; the row returns to "Expected" and the toast says so', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done]));
      f.detectChanges();
      const e = key(f, 'z', { ctrlKey: true });
      expect(e.defaultPrevented).toBeTrue();
      deleteArrival(77).flush(marie);
      f.detectChanges();
      expect(names(f, 'expected')).toContain('Marie Tremblay');
      expect(el(f).querySelector('.fd-toast__text')!.textContent).toBe('Arrival undone');
      expect(el(f).querySelector('.fd-toast__undo')).toBeNull();
      answerList(day([marie, jean, sophie, done]));
      http.verify();
    });

    it('Ctrl+Z with text in the box sends nothing and leaves the arrival (ordinary text undo)', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done]));
      f.detectChanges();
      type(f, 'ga');
      const e = key(f, 'z', { ctrlKey: true });
      expect(e.defaultPrevented).toBeFalse();
      http.verify();
      expect(f.componentInstance.rows.find(r => r.appointmentId === 77)!.desk.state).toBe('ARRIVED');
    });

    it('Ctrl+Z with an empty box but no toast does nothing', () => {
      const f = setup();
      key(f, 'z', { ctrlKey: true });
      http.verify();
    });

    it('the toast button and the row button both undo', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done]));
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-toast__undo')!.click();
      deleteArrival(77).flush(marie);
      answerList(day([marie, jean, sophie, done]));
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('#arrive-77')!.click();
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done]));
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-row[data-appt="77"] .fd-undo')!.click();
      deleteArrival(77).flush(marie);
      answerList(day([marie, jean, sophie, done]));
      http.verify();
    });

    it('Enter on an arrived row sends nothing and announces "Already here"', () => {
      const f = setup([here(marie), jean]);
      type(f, '12/04/1968');
      expect(active(f)).toBe('Marie Tremblay');
      key(f, 'Enter');
      http.verify();
      expect(el(f).querySelector('#fd-live')!.textContent).toBe('Already here');
    });

    it('a failed arrival shows the error, keeps the typed text and focus, and Enter retries', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush({ message: 'x' }, { status: 500, statusText: 'err' });
      f.detectChanges();
      expect(el(f).querySelector('[role=alert]')!.textContent).toContain('Server error');
      expect(box(f).value).toBe('trem');
      expect(document.activeElement).toBe(box(f));
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done]));
    });

    it('a 409 reloads the list', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush({ status: 409, error: 'INVALID_STATE', message: 'Appointment is closed' }, { status: 409, statusText: 'Conflict' });
      f.detectChanges();
      expect(el(f).querySelector('[role=alert]')!.textContent).toContain('This appointment is closed.');
      answerList(day([{ ...marie, desk: { state: 'CLOSED', reasons: [], notices: [] } }, jean]));
    });

    it('a 404 (deleted at another desk) reloads the list too, so the stale row goes away', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush({ status: 404, error: 'NOT_FOUND', message: 'Appointment not found' }, { status: 404, statusText: 'Not Found' });
      f.detectChanges();
      expect(el(f).querySelector('[role=alert]')).not.toBeNull();
      answerList(day([jean, sophie, done]));
      f.detectChanges();
      expect(names(f, 'expected')).not.toContain('Marie Tremblay');
    });

    it('two different rows can be in flight; the same row is never sent twice', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      key(f, 'Enter');
      const a = postArrival(77);
      type(f, 'jean');
      key(f, 'Enter');
      const b = postArrival(78);
      a.flush(here(marie));
      b.flush(here(jean));
      f.detectChanges();
      expect(names(f, 'here').sort()).toEqual(['Jean-François Gagnon', 'Marie Tremblay']);
    });

    it('does not wipe what the user already typed for the next patient when the arrival comes back', () => {
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      type(f, 'gag');
      postArrival(77).flush(here(marie));
      f.detectChanges();
      expect(box(f).value).toBe('gag');
      answerList(day([here(marie), jean, sophie, done]));
    });

    it('Shift+Enter opens the highlighted patient file', () => {
      const f = setup();
      const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      type(f, 'gagnon');
      key(f, 'Enter', { shiftKey: true });
      expect(nav).toHaveBeenCalledWith(['/patients', 13]);
      http.verify();
    });
  });

  describe('focus rule', () => {
    it('after every action the focus is in the box, and nothing but the box is ever focused by code', () => {
      const focus = spyOn(HTMLElement.prototype, 'focus').and.callThrough();
      const f = setup();
      type(f, 'trem');
      key(f, 'Enter');
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done]));
      f.detectChanges();
      key(f, 'ArrowDown');
      // open and close a panel, answer a consent
      el(f).querySelector<HTMLButtonElement>('.fd-row[data-appt="79"] .fd-toggle')!.click();
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-consent-yes')!.click();
      http.expectOne(r => r.method === 'PUT').flush({ contactConsent: 'GRANTED' });
      answerList(day([here(marie), jean, { ...sophie, patient: { ...sophie.patient, contactConsent: 'GRANTED' } }, done]));
      f.detectChanges();
      el(f).querySelector<HTMLButtonElement>('.fd-row[data-appt="79"] .fd-toggle')!.click();
      f.detectChanges();
      expect(document.activeElement).toBe(box(f));
      expect(focus.calls.all().every(c => c.object === box(f))).withContext('focus() targets').toBeTrue();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(focus.calls.all().every(c => c.object === box(f))).toBeTrue();
    });

    it('a key pressed while the focus is on the body moves the focus to the box', () => {
      const f = setup();
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement).toBe(document.body);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
      expect(document.activeElement).toBe(box(f));
    });

    it('but not for a shortcut such as Ctrl+C, nor when another control has the focus', () => {
      const f = setup();
      (document.activeElement as HTMLElement | null)?.blur();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
      expect(document.activeElement).toBe(document.body);
      el(f).querySelector<HTMLButtonElement>('.fd-toggle')!.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
      expect(document.activeElement).not.toBe(box(f));
    });

    it('Escape closes the open panel first, then clears the box', () => {
      const f = setup();
      type(f, 'sophie');
      el(f).querySelector<HTMLButtonElement>('.fd-toggle')!.click();
      f.detectChanges();
      expect(el(f).querySelector('app-fix-panel')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(el(f).querySelector('app-fix-panel')).toBeNull();
      expect(box(f).value).toBe('sophie');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(box(f).value).toBe('');
      expect(names(f).length).toBe(4);
    });
  });

  describe('a card number', () => {
    it('is dropped from the box at once, waits for Enter, then goes in a POST body only and leaves no trace anywhere', () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => spyOn(console, m));
      const f = setup();
      const href = location.href;
      type(f, NAM);
      expect(box(f).value).toBe('');
      expect(box(f).placeholder).toBe('Card read');
      http.expectNone(r => r.method === 'POST'); // nothing is sent before Enter
      key(f, 'Enter');
      const req = http.expectOne(r => r.method === 'POST' && r.url === `${API}/patients/search`);
      expect(req.request.body).toEqual({ healthNumber: NAM });
      expect(req.request.url).not.toContain('ROYS');
      expect(box(f).value).toBe('');
      expect(location.href).toBe(href);
      expect(location.href).not.toContain('ROYS');
      expect(document.title).not.toContain('ROYS');
      req.flush({ mode: 'HEALTH_NUMBER', matches: [], candidates: [], warnings: [] });
      f.detectChanges();
      expect(el(f).textContent).not.toContain(NAM);
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          expect(`${store.key(i)}=${store.getItem(store.key(i)!)}`).not.toContain('85522712');
        }
      }
      for (const s of spies) {
        expect(JSON.stringify(s.calls.allArgs())).not.toContain('85522712');
      }
    });

    it('a number typed with spaces or arriving inside a longer payload is recognised too', () => {
      const f = setup();
      type(f, 'roys 8552 2712');
      expect(box(f).value).toBe('');
      type(f, `%${NAM}?;`);
      expect(box(f).value).toBe('');
      http.verify();
    });

    it('a card number typed in pairs or with dots is dropped too, and a typo NAM is cleared on Enter, never linked', () => {
      const f = setup();
      for (const v of ['TREM 68 54 12 12', 'TREM.6854.1212']) {
        type(f, v);
        expect(box(f).value).withContext(v).toBe('');
        expect(el(f).querySelector('.fd-hint--card')).withContext(v).not.toBeNull();
      }
      type(f, 'TREM 68 13 12 12'); // month 13: not a valid structure, still a card number
      expect(el(f).querySelector('.fd-nomatch a')).toBeNull();
      expect(el(f).textContent).not.toContain('68 13');
      key(f, 'Enter');
      expect(box(f).value).toBe('');
      http.expectNone(r => r.method === 'POST');
    });

    it('the typo hint goes away on the next ordinary typing', () => {
      const f = setup();
      type(f, 'TREM 68 13 12 12');
      key(f, 'Enter');
      expect(el(f).querySelector('.fd-hint')!.textContent).toContain('does not look like a valid card number');
      type(f, 'tr');
      expect(el(f).querySelector('.fd-hint')).toBeNull();
    });
  });

  describe('fix panel inside the page', () => {
    it('expanding Sophie shows the consent question above a disabled Send link; "Yes" sends one PUT and the chip disappears without a reload', () => {
      const f = setup();
      el(f).querySelector<HTMLButtonElement>('.fd-row[data-appt="79"] .fd-toggle')!.click();
      f.detectChanges();
      const panel = el(f).querySelector('.fd-row[data-appt="79"] app-fix-panel')!;
      expect(panel.textContent).toContain('Accepts clinic messages?');
      expect(panel.querySelector<HTMLButtonElement>('.fd-send-disabled')!.disabled).toBeTrue();
      const chips = () => Array.from(el(f).querySelectorAll('.fd-row[data-appt="79"] .fd-row__chips .chip__label')).map(c => c.textContent);
      expect(chips()).toContain('Consent not answered');
      panel.querySelector<HTMLButtonElement>('.fd-consent-yes')!.click();
      const put = http.expectOne(r => r.method === 'PUT' && r.url === `${API}/patients/14/contact-consent`);
      expect(put.request.body).toEqual({ contactConsent: 'GRANTED' });
      put.flush({ contactConsent: 'GRANTED' });
      f.detectChanges();
      expect(chips()).not.toContain('Consent not answered');
      expect(chips()).toContain('Questionnaire missing');
      expect(el(f).querySelector('.fd-row[data-appt="79"] app-send-link')).not.toBeNull();
      answerList(day([marie, jean, sophie, done]));
      http.verify();
    });
  });

  describe('polling', () => {
    it('polls every 20 seconds while visible, and stops when the component is destroyed', fakeAsync(() => {
      const f = setup();
      tick(POLL_MS);
      expect(lists().length).toBe(1);
      f.destroy();
      tick(POLL_MS * 5);
      expect(lists().length).toBe(0);
      flush();
    }));

    it('does not poll while the tab is hidden', fakeAsync(() => {
      const f = setup();
      const vis = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('hidden');
      tick(POLL_MS * 3);
      expect(lists().length).toBe(0);
      vis.and.returnValue('visible');
      tick(POLL_MS);
      expect(lists().length).toBe(1);
      f.destroy();
      flush();
    }));

    it('does not poll while a panel is open, while a request is in flight, and polls again after', fakeAsync(() => {
      const f = setup();
      el(f).querySelector<HTMLButtonElement>('.fd-toggle')!.click();
      f.detectChanges();
      tick(POLL_MS * 2);
      expect(lists().length).toBe(0);
      el(f).querySelector<HTMLButtonElement>('.fd-toggle')!.click();
      f.detectChanges();
      type(f, 'trem');
      key(f, 'Enter');
      tick(POLL_MS);
      expect(lists().length).toBe(0);
      postArrival(77).flush(here(marie));
      answerList(day([here(marie), jean, sophie, done])); // the refresh after the action
      tick(POLL_MS);
      expect(lists().length).toBe(1);
      f.destroy();
      flush();
    }));

    it('a poll that moves a row to another group keeps the highlight on the same appointment', fakeAsync(() => {
      const f = setup();
      key(f, 'ArrowDown');
      expect(active(f)).toBe('Jean-François Gagnon');
      tick(POLL_MS);
      answerList(day([marie, here(jean), sophie, done]));
      f.detectChanges();
      expect(names(f, 'here')).toEqual(['Jean-François Gagnon']);
      expect(active(f)).toBe('Jean-François Gagnon');
      f.destroy();
      flush();
    }));

    it('when the highlighted row disappears the highlight falls back to the first row', fakeAsync(() => {
      const f = setup();
      key(f, 'ArrowDown');
      tick(POLL_MS);
      answerList(day([marie, sophie]));
      f.detectChanges();
      expect(active(f)).toBe('Marie Tremblay');
      f.destroy();
      flush();
    }));

    it('a fallback highlight nobody chose is not arrived by Enter (the poll dropped the highlighted row)', fakeAsync(() => {
      const f = setup();
      key(f, 'ArrowDown');
      key(f, 'ArrowDown');
      expect(active(f)).toBe('Sophie Roy');
      tick(POLL_MS);
      answerList(day([marie, jean, { ...sophie, status: 'CANCELLED', desk: { state: 'CLOSED', reasons: [], notices: [] } }, done]));
      f.detectChanges();
      expect(active(f)).toBe('Marie Tremblay');
      key(f, 'Enter');
      http.expectNone(r => r.method === 'POST');
      key(f, 'ArrowDown'); // choosing again works as usual
      key(f, 'Enter');
      postArrival(78).flush(here(jean));
      f.destroy();
      flush();
    }));

    it('a failed poll keeps the last list and shows when it was last updated; the next good poll clears the banner', fakeAsync(() => {
      const f = setup();
      tick(POLL_MS);
      lists()[0].flush({}, { status: 500, statusText: 'x' });
      f.detectChanges();
      expect(names(f).length).toBe(4);
      expect(el(f).querySelector('.banner--warning')!.textContent).toContain('List not updated since 09:41');
      expect(el(f).querySelector('.card.empty')).toBeNull();
      tick(POLL_MS);
      answerList(day([marie]));
      f.detectChanges();
      expect(el(f).querySelector('.banner--warning')).toBeNull();
      f.destroy();
      flush();
    }));
  });

  describe('idle masking', () => {
    it('after five minutes the rows are masked and nothing is polled; a key unmasks and triggers exactly one poll', fakeAsync(() => {
      const f = setup();
      type(f, 'tre');
      tickAnswering(FD_IDLE_MS);
      f.detectChanges();
      const page = el(f).querySelector('.page')!;
      expect(page.classList).toContain('fd-locked');
      expect(el(f).querySelector('.fd-list')!.getAttribute('aria-hidden')).toBe('true');
      expect(el(f).querySelector('.fd-kpis')!.getAttribute('aria-hidden')).toBe('true');
      expect(el(f).querySelector('.fd-idle')!.textContent).toContain('Screen hidden');
      expect(box(f).value).toBe('');
      // no patient name stays in the live regions behind the mask
      expect(el(f).querySelector('#fd-selection')!.textContent).toBe('');
      expect(el(f).querySelector('#fd-live')!.textContent).toBe('');
      tick(POLL_MS * 3);
      expect(lists().length).toBe(0);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      f.detectChanges();
      expect(page.classList).not.toContain('fd-locked');
      expect(lists().length).toBe(1);
      f.destroy();
      flush();
    }));

    it('a pointer event also unmasks; activity before the five minutes keeps it unmasked', fakeAsync(() => {
      const f = setup();
      tickAnswering(FD_IDLE_MS - 1000);
      document.dispatchEvent(new Event('wheel'));
      tickAnswering(FD_IDLE_MS - 1000);
      f.detectChanges();
      expect(el(f).querySelector('.page')!.classList).not.toContain('fd-locked');
      tickAnswering(1000);
      f.detectChanges();
      expect(el(f).querySelector('.page')!.classList).toContain('fd-locked');
      document.dispatchEvent(new Event('pointerdown'));
      f.detectChanges();
      expect(el(f).querySelector('.page')!.classList).not.toContain('fd-locked');
      expect(lists().length).toBe(1);
      f.destroy();
      flush();
    }));

    it('locking closes an open panel so a link code does not stay behind the mask', fakeAsync(() => {
      const f = setup();
      el(f).querySelector<HTMLButtonElement>('.fd-toggle')!.click();
      f.detectChanges();
      expect(el(f).querySelector('app-fix-panel')).not.toBeNull();
      tick(FD_IDLE_MS);
      f.detectChanges();
      expect(el(f).querySelector('app-fix-panel')).toBeNull();
      f.destroy();
      flush();
    }));

    it('the destroyed page leaves no timer behind', fakeAsync(() => {
      const f = setup();
      f.destroy();
      tick(FD_IDLE_MS * 2);
      expect(lists().length).toBe(0);
    }));
  });

  describe('shortcuts popover', () => {
    it('lists the keys, closes with Escape and with an outside click, and is hidden on narrow screens by .hide-sm', () => {
      const f = setup();
      const btn = el(f).querySelector<HTMLButtonElement>('#fd-keys-btn')!;
      expect(btn.closest('.hide-sm')).not.toBeNull();
      btn.click();
      f.detectChanges();
      const pop = el(f).querySelector('.fd-keys')!;
      expect(pop.querySelectorAll('dt').length).toBe(6);
      expect(pop.textContent).toContain('Shift+Enter');
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(el(f).querySelector('.fd-keys')).toBeNull();
      btn.click();
      f.detectChanges();
      document.body.click();
      f.detectChanges();
      expect(el(f).querySelector('.fd-keys')).toBeNull();
    });
  });

  describe('French', () => {
    it('renders the page in French with Quebec typography', () => {
      const f = setup([marie, jean, sophie, done], 'RECEPTION', {}, 'fr');
      expect(el(f).querySelector('h1')!.textContent).toBe('Arrivées');
      expect(el(f).textContent).toContain('mis à jour à 9 h 41');
      expect(el(f).textContent).toContain('Attendus');
      expect(el(f).textContent).toContain('Terminés');
      type(f, 'zzzq');
      expect(el(f).querySelector('.fd-nomatch .empty__title')!.textContent).toBe('Aucun rendez-vous aujourd\'hui pour « zzzq ».');
      expect(el(f).querySelector('.fd-nomatch a')!.textContent).toBe('Chercher dans tous les dossiers');
    });
  });
});
