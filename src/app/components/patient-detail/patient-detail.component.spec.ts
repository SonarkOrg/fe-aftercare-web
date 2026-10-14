import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { CheckIn } from '../../models/follow-up.model';
import { AccessLinkComponent } from '../../shared/access-link/access-link.component';
import { AppointmentBadgeComponent } from '../../shared/appointment-badge/appointment-badge.component';
import { todayLocalIsoDate } from '../../shared/link.util';
import { HeaderComponent } from '../../shared/header/header.component';
import { FULL_Q, JANE, alertDto, appointment, followUp } from '../../testing/fixtures';
import { AlertTableComponent } from '../alert-table/alert-table.component';
import { FollowUpFormComponent } from '../follow-up-form/follow-up-form.component';
import { PatientDetailComponent } from './patient-detail.component';

describe('PatientDetailComponent', () => {
  let fixture: ComponentFixture<PatientDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const code = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

  const checkIn = (id: number): CheckIn => ({
    id, followUpId: 11, checkInDate: '2026-10-1' + id, submittedAt: '2026-10-13T14:00:00Z', questionnaireDefinitionId: 7,
    questionnaireUrl: FULL_Q.url, questionnaireVersion: '1',
    response: {
      resourceType: 'QuestionnaireResponse', questionnaire: FULL_Q.url + '|1', status: 'completed',
      item: [{ linkId: 'PAIN', answer: [{ valueInteger: 4 }] }, { linkId: 'FEVER', answer: [{ valueBoolean: false }] }]
    }
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientDetailComponent, FollowUpFormComponent, AccessLinkComponent, AlertTableComponent,
        AppointmentBadgeComponent, QuestionnaireFormComponent, HeaderComponent],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientDetailComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  function flushAll(data: { followUps?: any[]; checkIns?: any[]; alerts?: any[]; appointments?: any[] } = {}) {
    http.expectOne(`${api}/patients/5`).flush(JANE);
    http.expectOne(`${api}/patients/5/follow-ups`).flush(data.followUps ?? []);
    http.expectOne(`${api}/patients/5/check-ins`).flush(data.checkIns ?? []);
    http.expectOne(`${api}/patients/5/alerts`).flush(data.alerts ?? []);
    http.expectOne(`${api}/patients/5/appointments`).flush(data.appointments ?? []);
    fixture.detectChanges();
  }

  function init(data: Parameters<typeof flushAll>[0] = {}) {
    fixture.detectChanges();
    flushAll(data);
  }

  it('makes five parallel calls on init and renders demographics', () => {
    fixture.detectChanges();
    expect(http.match(() => true).length).toBe(5);
  });

  it('renders patient demographics, empty states and a New appointment link', () => {
    init();
    expect(el.textContent).toContain('Jane Doe');
    expect(el.textContent).toContain('jane@example.com');
    expect(el.textContent).toContain('No check-ins yet.');
    expect(el.textContent).toContain('No alerts.');
    const link = Array.from(el.querySelectorAll('a')).find(a => a.textContent!.includes('New appointment'))!;
    expect(link.getAttribute('href')).toBe('/appointments/new?patientId=5');
  });

  it('shows "Patient not found." on 404', () => {
    fixture.detectChanges();
    http.expectOne(`${api}/patients/5`).flush({ error: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    http.match(() => true); // drop the other (cancelled) requests
    fixture.detectChanges();
    expect(el.textContent).toContain('Patient not found.');
  });

  it('shows the enroll form when there is no current follow-up, and a link after creating one', () => {
    init();
    expect(el.querySelector('app-follow-up-form')).not.toBeNull();
    const discharge = el.querySelector('#fu-discharge') as HTMLInputElement;
    expect(discharge.max).toBe(todayLocalIsoDate());
    (el.querySelector('app-follow-up-form form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const post = http.expectOne(`${api}/patients/5/follow-ups`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.specialty).toBe('VISCERAL_SURGERY');
    expect(post.request.body.durationDays).toBe(7);
    post.flush({ followUp: followUp(), accessCode: code }, { status: 201, statusText: 'Created' });
    flushAll({ followUps: [followUp()] });
    const input = el.querySelector('.access-link input') as HTMLInputElement;
    expect(input.value).toContain('/q/' + code);
    expect(el.querySelector('app-follow-up-form')).toBeNull();
  });

  it('shows the enrollment form again for an EXPIRED follow-up', () => {
    init({ followUps: [followUp({ status: 'EXPIRED' })] });
    expect(el.querySelector('app-follow-up-form')).not.toBeNull();
    expect(el.querySelector('#regenerate-link')).toBeNull();
    expect(el.querySelector('#close-follow-up')).not.toBeNull();
  });

  it('shows the NO_ACTIVE_QUESTIONNAIRE and FOLLOW_UP_ALREADY_ACTIVE messages', () => {
    init();
    const submit = () => (el.querySelector('app-follow-up-form form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    submit();
    http.expectOne(`${api}/patients/5/follow-ups`).flush(
      { status: 409, error: 'NO_ACTIVE_QUESTIONNAIRE', message: '', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain('No active form is configured for this specialty.');
    submit();
    http.expectOne(`${api}/patients/5/follow-ups`).flush(
      { status: 409, error: 'FOLLOW_UP_ALREADY_ACTIVE', message: '', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain('This patient already has an active follow-up.');
  });

  it('shows 400 field errors inline', () => {
    init();
    (el.querySelector('app-follow-up-form form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne(`${api}/patients/5/follow-ups`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { dischargeDate: 'must not be in the future' } },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('.field-error')!.textContent).toBe('must not be in the future');
  });

  it('regenerate is confirm-guarded, and shows the new link', () => {
    init({ followUps: [followUp()] });
    expect(el.textContent).toContain('Visceral surgery');
    expect(el.textContent).toContain('https://aftercare.example/fhir/Questionnaire/followup-visceral-surgery|1');
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(false);
    (el.querySelector('#regenerate-link') as HTMLButtonElement).click();
    expect(confirmSpy).toHaveBeenCalledWith('The previous link will stop working. Continue?');
    http.expectNone(`${api}/follow-ups/11/access-code`);

    confirmSpy.and.returnValue(true);
    (el.querySelector('#regenerate-link') as HTMLButtonElement).click();
    const req = http.expectOne(`${api}/follow-ups/11/access-code`);
    expect(req.request.method).toBe('POST');
    req.flush({ followUp: followUp(), accessCode: code });
    flushAll({ followUps: [followUp()] });
    expect((el.querySelector('.access-link input') as HTMLInputElement).value).toContain('/q/' + code);
  });

  it('Copy link calls the clipboard', async () => {
    init({ followUps: [followUp()] });
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);
    (el.querySelector('#regenerate-link') as HTMLButtonElement).click();
    http.expectOne(`${api}/follow-ups/11/access-code`).flush({ followUp: followUp(), accessCode: code });
    flushAll({ followUps: [followUp()] });
    expect(confirmSpy).toHaveBeenCalled();

    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    const copy = Array.from(el.querySelectorAll('.access-link button')).find(b => b.textContent!.includes('Copy link')) as HTMLButtonElement;
    copy.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(write).toHaveBeenCalledWith(jasmine.stringContaining('/q/' + code));
    expect(el.querySelector('.copy-message')!.textContent).toBe('Copied');
  });

  it('close follow-up is confirm-guarded', () => {
    init({ followUps: [followUp()] });
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);
    (el.querySelector('#close-follow-up') as HTMLButtonElement).click();
    expect(confirmSpy).toHaveBeenCalled();
    const req = http.expectOne(`${api}/follow-ups/11/close`);
    expect(req.request.method).toBe('POST');
    req.flush(followUp({ status: 'CLOSED' }));
    flushAll({ followUps: [followUp({ status: 'CLOSED' })] });
    expect(el.querySelector('app-follow-up-form')).not.toBeNull();
  });

  it('expanding a check-in fetches its definition once and renders it read-only', () => {
    init({ followUps: [followUp()], checkIns: [checkIn(3), checkIn(2)] });
    expect(el.querySelector('dl.q-readonly')).toBeNull();
    const buttons = el.querySelectorAll<HTMLButtonElement>('.btn-toggle');
    buttons[0].click();
    fixture.detectChanges();
    const req = http.expectOne(`${api}/questionnaires/7`);
    req.flush({ id: 7, title: { fr: 'a', en: 'b' }, questionnaire: FULL_Q, rules: [] });
    fixture.detectChanges();
    const dl = el.querySelector('dl.q-readonly')!;
    expect(dl.textContent).toContain('Pain level?');
    expect(dl.textContent).toContain('4');
    expect(el.querySelector('.answers-row input, .answers-row textarea')).toBeNull();

    // second check-in with the same definition: no further request
    buttons[1].click();
    fixture.detectChanges();
    http.expectNone(`${api}/questionnaires/7`);
    expect(el.querySelectorAll('dl.q-readonly').length).toBe(2);
  });

  it('renders alerts and appointments', () => {
    init({
      alerts: [alertDto()],
      appointments: [appointment({ status: 'READY' })]
    });
    expect(el.querySelector('app-alert-table')!.textContent).toContain('Severe pain reported (8/10)');
    expect(el.querySelector('app-alert-table th')!.textContent).toContain('Severity');
    const apptLink = el.querySelector('.appointments ul a')!;
    expect(apptLink.getAttribute('href')).toBe('/appointments/4');
    expect(apptLink.textContent).toContain('2026-10-14 08:30');
    expect(el.querySelector('.appointments .badge')!.textContent).toBe('Ready');
  });
});
