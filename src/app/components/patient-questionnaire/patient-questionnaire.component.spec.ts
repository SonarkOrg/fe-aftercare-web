import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../environments/environment';
import { StaffAuth } from '../../auth/staff-auth';
import { StaffAuthInterceptor } from '../../auth/staff-auth.interceptor';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { PublicSession } from '../../models/public-session.model';
import { SIMPLE_Q, publicMessage, publicThread } from '../../testing/fixtures';
import { PatientMessagesComponent } from './patient-messages/patient-messages.component';
import { PATIENT_MESSAGES_TEXT } from './patient-messages/patient-messages.i18n';
import { PatientQuestionnaireComponent } from './patient-questionnaire.component';
import { QUESTIONNAIRE_TEXT } from './patient-questionnaire.i18n';

describe('PatientQuestionnaireComponent', () => {
  let fixture: ComponentFixture<PatientQuestionnaireComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/public/q/abc`;
  const murl = `${url}/messages`;
  let query: Record<string, string> = {};
  const fr = QUESTIONNAIRE_TEXT.fr;
  const en = QUESTIONNAIRE_TEXT.en;

  const checkin: PublicSession = {
    kind: 'FOLLOW_UP_CHECKIN', submitted: false, questionnaire: SIMPLE_Q,
    checkIn: { checkInDate: '2026-10-14', followUpEndDate: '2026-10-17' }, appointment: null
  };
  const intake: PublicSession = {
    kind: 'APPOINTMENT_INTAKE', submitted: false, questionnaire: SIMPLE_Q, checkIn: null,
    appointment: { type: 'PRE_OP_CONSULT', scheduledAt: '2026-10-16T08:30:00', durationMinutes: 30, location: 'Clinique A' }
  };

  let staffToken: jasmine.Spy;

  beforeEach(async () => {
    query = {};
    staffToken = jasmine.createSpy('getAccessToken').and.callFake(() => { throw new Error('the public page must never ask for a staff token'); });
    try { localStorage.removeItem('aftercare.lang'); } catch { /* ignore */ }
    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [PatientQuestionnaireComponent, PatientMessagesComponent, QuestionnaireFormComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        // the REAL interceptor, with a staff-auth that throws: any /public call that wrongly reached it would fail the request
        { provide: StaffAuth, useValue: { getAccessToken: staffToken } },
        { provide: HTTP_INTERCEPTORS, useClass: StaffAuthInterceptor, multi: true },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ code: 'abc' }), get queryParamMap() { return convertToParamMap(query); } } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientQuestionnaireComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    expect(staffToken).not.toHaveBeenCalled();
    try { localStorage.removeItem('aftercare.lang'); } catch { /* ignore */ }
    document.documentElement.lang = 'en';
  });

  /** The unread count for the Messages tab is requested once after the session loads. */
  function flushThread(body = publicThread()) {
    http.expectOne(r => r.url === murl && r.method === 'GET').flush(body);
    fixture.detectChanges();
  }

  function load(session: PublicSession, thread = publicThread()) {
    fixture.detectChanges();
    http.expectOne(url).flush(session);
    flushThread(thread);
  }

  function answerYes() {
    (el.querySelector('[data-id="FEVER"] .q-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  const submitBtn = () => el.querySelector('#submit') as HTMLButtonElement;

  it('shows a loading state, then the form (French by default) for an open check-in', () => {
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.loading);
    http.expectOne(url).flush(checkin);
    flushThread();
    expect(el.querySelector('app-questionnaire-form')).not.toBeNull();
    expect(el.querySelector('h1')!.textContent).toBe(fr.checkinTitle);
    expect(el.textContent).toContain('2026-10-14');
    expect(el.textContent).toContain('Simple');
    expect(el.textContent).toContain('Avez-vous de la fièvre?');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('shows the "already" state when submitted is true', () => {
    load({ ...checkin, submitted: true });
    expect(el.textContent).toContain(fr.alreadyCheckin);
    expect(el.querySelector('app-questionnaire-form')).toBeNull();
  });

  it('shows the intake "already" text for an appointment', () => {
    load({ ...intake, submitted: true });
    expect(el.textContent).toContain(fr.alreadyIntake);
  });

  it('shows the invalid-link state on 404', () => {
    fixture.detectChanges();
    http.expectOne(url).flush({ status: 404, error: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.invalid);
    expect(el.querySelector('app-questionnaire-form')).toBeNull();
  });

  it('shows an error with a Retry button on other failures, and Retry reloads', () => {
    fixture.detectChanges();
    http.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.error);
    (el.querySelector('#retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne(url).flush(checkin);
    flushThread();
    expect(el.querySelector('app-questionnaire-form')).not.toBeNull();
  });

  it('toggles language, updates documentElement.lang and remembers the choice', () => {
    load(checkin);
    const toggle = el.querySelector('#lang-toggle') as HTMLButtonElement;
    expect(toggle.textContent!.trim()).toBe('English');
    toggle.click();
    fixture.detectChanges();
    expect(document.documentElement.lang).toBe('en');
    expect(toggle.textContent!.trim()).toBe('Français');
    expect(el.querySelector('h1')!.textContent).toBe(en.checkinTitle);
    expect(el.textContent).toContain('Simple form');
    expect(el.textContent).toContain('Do you have a fever?');
    expect(localStorage.getItem('aftercare.lang')).toBe('en');
  });

  it('uses the stored language on load', () => {
    localStorage.setItem('aftercare.lang', 'en');
    load(checkin);
    expect(el.querySelector('h1')!.textContent).toBe(en.checkinTitle);
    expect(document.documentElement.lang).toBe('en');
  });

  it('always shows the emergency footer, in both languages', () => {
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.emergency);
    http.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain('911');
    expect(el.textContent).toContain('811');
    (el.querySelector('#lang-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain(en.emergency);
  });

  it('disables submit until the form emits a response, and POSTs exactly that response', () => {
    load(checkin);
    expect(submitBtn().disabled).toBeTrue();
    answerYes();
    expect(submitBtn().disabled).toBeFalse();
    const emitted = fixture.componentInstance.current;
    submitBtn().click();
    fixture.detectChanges();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(emitted!);
    expect(req.request.body.item[0]).toEqual({ linkId: 'FEVER', answer: [{ valueBoolean: true }] });
    req.flush({ kind: 'FOLLOW_UP_CHECKIN', submittedAt: 'x', checkInDate: '2026-10-14' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.doneCheckin);
  });

  it('focuses the status message after a successful submit', fakeAsync(() => {
    load(checkin);
    answerYes();
    submitBtn().click();
    http.expectOne(url).flush({ kind: 'FOLLOW_UP_CHECKIN', submittedAt: 'x', checkInDate: '2026-10-14' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    tick();
    const status = el.querySelector('[role="status"].pq-done') as HTMLElement;
    expect(status).not.toBeNull();
    expect(status.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(status);
  }));

  it('a double click on submit sends exactly one POST', () => {
    load(checkin);
    answerYes();
    submitBtn().click();
    submitBtn().click();
    fixture.componentInstance.submit();
    const posts = http.match(r => r.method === 'POST');
    expect(posts.length).toBe(1);
    posts[0].flush({ kind: 'FOLLOW_UP_CHECKIN', submittedAt: 'x', checkInDate: '2026-10-14' }, { status: 201, statusText: 'Created' });
  });

  it('the language toggle carries the lang of the language it switches to', () => {
    load(checkin);
    const toggle = el.querySelector('#lang-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('lang')).toBe('en');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('lang')).toBe('fr');
  });

  it('shows the intake confirmation after a 201', () => {
    load(intake);
    answerYes();
    submitBtn().click();
    http.expectOne(url).flush({ kind: 'APPOINTMENT_INTAKE', submittedAt: 'x', checkInDate: null }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.doneIntake);
  });

  it('shows the intake heading with date, time and location', () => {
    load(intake);
    expect(el.querySelector('h1')!.textContent).toBe(fr.intakeTitle);
    expect(el.textContent).toContain('2026-10-16 08:30');
    expect(el.textContent).toContain('Clinique A');
  });

  it('maps a 409 on submit to the already state', () => {
    load(checkin);
    answerYes();
    submitBtn().click();
    http.expectOne(url).flush({ status: 409, error: 'ALREADY_SUBMITTED' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.alreadyCheckin);
  });

  it('maps a 404 on submit to the invalid state', () => {
    load(checkin);
    answerYes();
    submitBtn().click();
    http.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.invalid);
  });

  it('maps a 400 on submit to the validation error and keeps the answers', () => {
    load(checkin);
    answerYes();
    submitBtn().click();
    http.expectOne(url).flush({ status: 400, error: 'VALIDATION_FAILED', fieldErrors: {} }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.validationError);
    expect(el.querySelector('[data-id="FEVER"] .q-btn.selected')).not.toBeNull();
    expect(submitBtn().disabled).toBeFalse();
  });

  it('maps another submit failure to the generic error', () => {
    load(checkin);
    answerYes();
    submitBtn().click();
    http.expectOne(url).flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.textContent).toContain(fr.error);
    expect(el.textContent).not.toContain(fr.validationError);
  });

  describe('Messages tab', () => {
    const mfr = PATIENT_MESSAGES_TEXT.fr;
    const men = PATIENT_MESSAGES_TEXT.en;
    const tab = (name: 'questionnaire' | 'messages') => el.querySelector<HTMLButtonElement>('#pq-tab-' + name)!;
    const openMessages = (items = [publicMessage()], extra: Partial<ReturnType<typeof publicThread>> = {}) => {
      tab('messages').click();
      fixture.detectChanges();
      http.expectOne(r => r.url === murl && r.method === 'GET').flush(publicThread({ items, ...extra }));
      fixture.detectChanges();
    };

    it('shows the tabs after the session loads (French by default) but not on an invalid link', () => {
      load(checkin);
      expect(tab('questionnaire').textContent!.trim()).toBe(mfr.tabQuestionnaire);
      expect(tab('messages').textContent!.trim()).toBe(mfr.tabMessages);
      expect(tab('questionnaire').getAttribute('aria-selected')).toBe('true');
      expect(tab('messages').getAttribute('aria-selected')).toBe('false');
    });

    it('has no tabs while loading or on an invalid link', () => {
      fixture.detectChanges();
      expect(el.querySelector('.pq-tabs')).toBeNull();
      http.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.querySelector('.pq-tabs')).toBeNull();
    });

    it('shows the unread count on the tab with an accessible name', () => {
      load(checkin, publicThread({ unreadCount: 2 }));
      const badge = tab('messages').querySelector('.pq-count')!;
      expect(badge.textContent).toBe('2 non lus');
      expect(badge.querySelector('.sr-only')!.textContent).toBe(' non lus');
      expect(badge.hasAttribute('aria-label')).toBeFalse();
    });

    it('aria-controls on the Messages tab only points at a panel that exists', () => {
      load(checkin, publicThread({ unreadCount: 0 }));
      expect(tab('messages').hasAttribute('aria-controls')).toBeFalse();
      expect(el.querySelector('#pq-panel-messages')).toBeNull();
      openMessages([]);
      expect(tab('messages').getAttribute('aria-controls')).toBe('pq-panel-messages');
      expect(el.querySelector('#pq-panel-messages')).not.toBeNull();
    });

    it('ignores a failing unread request: the tab still shows', () => {
      fixture.detectChanges();
      http.expectOne(url).flush(checkin);
      http.expectOne(r => r.url === murl).flush('x', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(tab('messages')).not.toBeNull();
      expect(tab('messages').querySelector('.pq-count')).toBeNull();
    });

    it('opens directly with ?tab=messages', () => {
      query = { tab: 'messages' };
      fixture.detectChanges();
      http.expectOne(url).flush(checkin);
      http.expectOne(r => r.url === murl && r.method === 'GET').flush(publicThread());
      fixture.detectChanges();
      http.expectOne(r => r.url === murl && r.method === 'GET').flush(publicThread({ items: [publicMessage()] }));
      http.expectOne(r => r.url === murl + '/read').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(tab('messages').getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-patient-messages')).not.toBeNull();
    });

    it('arrow keys switch tabs and the emergency footer stays visible on both', () => {
      load(checkin);
      (el.querySelector('.pq-tabs') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();
      http.expectOne(r => r.url === murl && r.method === 'GET').flush(publicThread());
      expect(tab('messages').getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('.pq-emergency')).not.toBeNull();
      expect(el.querySelector('#pq-panel-questionnaire')!.hasAttribute('hidden')).toBeTrue();
    });

    it('lists the messages in French by default, marks them seen and clears the count; the EN toggle switches the strings', () => {
      load(checkin, publicThread({ unreadCount: 1 }));
      openMessages([publicMessage({ id: 5, body: 'Bonjour', senderName: 'Marie' })], { unreadCount: 1 });
      const read = http.expectOne(r => r.url === murl + '/read');
      expect(read.request.body).toEqual({ upToId: 5 });
      expect(read.request.headers.has('Authorization')).toBeFalse();
      read.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(tab('messages').querySelector('.pq-count')).toBeNull();
      expect(el.querySelector('.pq-intro')!.textContent).toBe(mfr.intro);
      expect(el.querySelector('.pq-clinic')!.textContent).toContain('Clinique Test');
      expect(el.querySelector('.pq-clinic a')!.getAttribute('href')).toBe('tel:514-555-0100');
      expect(el.querySelector('.pq-msg-item .pq-meta')!.textContent).toContain('Marie');
      expect(el.querySelector('label[for=pq-msg-body]')!.textContent).toBe(mfr.label);
      expect(el.querySelector('.pq-send')!.textContent!.trim()).toBe(mfr.send);
      (el.querySelector('#lang-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.pq-intro')!.textContent).toBe(men.intro);
      expect(el.querySelector('label[for=pq-msg-body]')!.textContent).toBe(men.label);
      expect(el.querySelector('.pq-send')!.textContent!.trim()).toBe(men.send);
    });

    it('shows the empty state', () => {
      load(checkin);
      openMessages([]);
      expect(el.querySelector('.pq-empty')!.textContent).toBe(mfr.empty);
    });

    it('updates the character counter as the patient types', () => {
      load(checkin);
      openMessages([]);
      const ta = el.querySelector('#pq-msg-body') as HTMLTextAreaElement;
      expect(el.querySelector('.pq-counter')!.textContent).toBe('0 / 2000 caractères');
      ta.value = 'abcde';
      ta.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(el.querySelector('.pq-counter')!.textContent).toBe('5 / 2000 caractères');
    });

    function type(text: string) {
      const ta = el.querySelector('#pq-msg-body') as HTMLTextAreaElement;
      ta.value = text;
      ta.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
    const send = () => (el.querySelector('.pq-send') as HTMLButtonElement).click();

    it('sends a message with no Authorization header and appends it', async () => {
      load(checkin);
      openMessages([]);
      type('  Ma douleur augmente  ');
      send();
      const post = http.expectOne(r => r.url === murl && r.method === 'POST');
      expect(post.request.body).toEqual({ body: 'Ma douleur augmente' });
      expect(post.request.headers.has('Authorization')).toBeFalse();
      post.flush(publicMessage({ id: 9, sender: 'PATIENT', senderName: null, body: 'Ma douleur augmente' }), { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      for (let i = 0; i < 3; i++) {
        await Promise.resolve(); // the messages view polls: whenStable() would never resolve
      }
      fixture.detectChanges();
      const items = el.querySelectorAll('.pq-msg-item');
      expect(items.length).toBe(1);
      expect(items[0].classList).toContain('pq-msg-item--me');
      expect(items[0].querySelector('.pq-meta')!.textContent).toContain(mfr.you);
      expect((el.querySelector('#pq-msg-body') as HTMLTextAreaElement).value).toBe('');
    });

    it('shows the rate-limit message on 429', () => {
      load(checkin);
      openMessages([]);
      type('hello');
      send();
      http.expectOne(r => r.url === murl && r.method === 'POST').flush({ status: 429, error: 'RATE_LIMITED' }, { status: 429, statusText: 'Too Many Requests' });
      fixture.detectChanges();
      expect(el.querySelector('.pq-compose .pq-error')!.textContent).toContain(mfr.rateLimited);
      expect((el.querySelector('#pq-msg-body') as HTMLTextAreaElement).value).toBe('hello'); // the draft is kept
    });

    it('shows the invalid-body message on 400 and a retry on other errors', () => {
      load(checkin);
      openMessages([]);
      type('hello');
      send();
      http.expectOne(r => r.method === 'POST' && r.url === murl).flush({ status: 400 }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el.querySelector('.pq-compose .pq-error')!.textContent).toContain(mfr.invalidBody);
      send();
      http.expectOne(r => r.method === 'POST' && r.url === murl).flush('x', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el.querySelector('.pq-compose .pq-error')!.textContent).toContain(mfr.error);
      (el.querySelector('.pq-retry') as HTMLButtonElement).click();
      http.expectOne(r => r.method === 'POST' && r.url === murl).flush(publicMessage({ id: 3, sender: 'PATIENT', body: 'hello' }), { status: 201, statusText: 'Created' });
    });

    it('switches the whole page to the invalid state on 404', () => {
      load(checkin);
      openMessages([]);
      type('hello');
      send();
      http.expectOne(r => r.method === 'POST' && r.url === murl).flush({}, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el.textContent).toContain(fr.invalid);
      expect(el.querySelector('.pq-tabs')).toBeNull();
    });

    it('shows an HTML body escaped, as plain text', () => {
      load(checkin);
      openMessages([publicMessage({ id: 2, sender: 'STAFF', body: '<img src=x onerror=alert(1)><b>bold</b>' })]);
      http.expectOne(r => r.url === murl + '/read').flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      const body = el.querySelector('.pq-msg-item .pq-body')!;
      expect(body.textContent).toBe('<img src=x onerror=alert(1)><b>bold</b>');
      expect(el.querySelector('.pq-thread img')).toBeNull();
      expect(el.querySelector('.pq-thread b')).toBeNull();
    });

    it('loads earlier messages and has a Refresh button', () => {
      load(checkin);
      openMessages([publicMessage({ id: 5, sender: 'PATIENT', senderName: null })], { hasMore: true });
      (el.querySelector('.pq-earlier') as HTMLButtonElement).click();
      const earlier = http.expectOne(r => r.url === murl && r.params.get('before') === '5');
      earlier.flush(publicThread({ items: [publicMessage({ id: 2, sender: 'PATIENT', senderName: null, body: 'old' })], hasMore: false }));
      fixture.detectChanges();
      expect(Array.from(el.querySelectorAll('.pq-msg-item .pq-body')).map(b => b.textContent)).toEqual(['old', 'Bonjour']);
      expect(el.querySelector('.pq-earlier')).toBeNull();
      (el.querySelector('.pq-refresh') as HTMLButtonElement).click();
      http.expectOne(r => r.url === murl && r.method === 'GET').flush(publicThread({ items: [] }));
    });

    it('polls every 30 s while the tab is selected and the document is visible', fakeAsync(() => {
      spyOnProperty(document, 'visibilityState').and.returnValue('visible');
      load(checkin);
      tab('messages').click();
      fixture.detectChanges();
      http.expectOne(r => r.url === murl && r.method === 'GET').flush(publicThread());
      fixture.detectChanges();
      tick(30_000);
      const poll = http.expectOne(r => r.url === murl && r.method === 'GET');
      expect(poll.request.method).toBe('GET');
      poll.flush(publicThread());
      fixture.destroy(); // stops the timer
    }));
  });
});
