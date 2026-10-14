import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../environments/environment';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { PublicSession } from '../../models/public-session.model';
import { SIMPLE_Q } from '../../testing/fixtures';
import { PatientQuestionnaireComponent } from './patient-questionnaire.component';
import { QUESTIONNAIRE_TEXT } from './patient-questionnaire.i18n';

describe('PatientQuestionnaireComponent', () => {
  let fixture: ComponentFixture<PatientQuestionnaireComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/public/q/abc`;
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

  beforeEach(async () => {
    try { localStorage.removeItem('aftercare.lang'); } catch { /* ignore */ }
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [PatientQuestionnaireComponent, QuestionnaireFormComponent],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ code: 'abc' }) } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientQuestionnaireComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    try { localStorage.removeItem('aftercare.lang'); } catch { /* ignore */ }
    document.documentElement.lang = 'en';
  });

  function load(session: PublicSession) {
    fixture.detectChanges();
    http.expectOne(url).flush(session);
    fixture.detectChanges();
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
    fixture.detectChanges();
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
    fixture.detectChanges();
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
});
