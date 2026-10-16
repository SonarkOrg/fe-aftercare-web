import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { CheckIn } from '../../models/follow-up.model';
import { AccessLinkComponent } from '../../shared/access-link/access-link.component';
import { addDays, businessToday } from '../../shared/link.util';
import { CLINIC, FULL_Q, JANE, alertDto, appointment, careTeamMember, contactPrefs, followUp, medical, conversation, missedAlert, providePermissions } from '../../testing/fixtures';
import { AccessRole } from '../../models/me.model';
import { MessageThreadComponent } from '../../shared/message-thread/message-thread.component';
import { PatientAuditComponent } from '../patient-file/patient-audit/patient-audit.component';
import { PatientContactsComponent } from '../patient-file/patient-contacts/patient-contacts.component';
import { PatientDocumentsComponent } from '../patient-file/patient-documents/patient-documents.component';
import { PatientMedicalComponent } from '../patient-file/patient-medical/patient-medical.component';
import { PatientTimelineComponent } from '../patient-file/patient-timeline/patient-timeline.component';
import { AlertTableComponent } from '../alert-table/alert-table.component';
import { FollowUpFormComponent } from '../follow-up-form/follow-up-form.component';
import { ActorSelectComponent } from '../../shared/actor-select/actor-select.component';
import { SendLinkComponent } from '../../shared/send-link/send-link.component';
import { PatientDetailComponent } from './patient-detail.component';

@Component({ selector: 'app-patient-notifications', template: '' })
class StubNotificationsComponent {
  @Input() patientId = 0;
  @Output() saved = new EventEmitter<any>();
}

describe('PatientDetailComponent', () => {
  let fixture: ComponentFixture<PatientDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const code = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  let query: Record<string, string> = {};

  const checkIn = (id: number): CheckIn => ({
    id, followUpId: 11, checkInDate: '2026-10-1' + id, submittedAt: '2026-10-13T14:00:00Z', questionnaireDefinitionId: 7,
    questionnaireUrl: FULL_Q.url, questionnaireVersion: '1',
    response: {
      resourceType: 'QuestionnaireResponse', questionnaire: FULL_Q.url + '|1', status: 'completed',
      item: [{ linkId: 'PAIN', answer: [{ valueInteger: 4 }] }, { linkId: 'FEVER', answer: [{ valueBoolean: false }] }]
    }
  });

  beforeEach(async () => {
    query = {};
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule, SendLinkComponent, ActorSelectComponent],
      declarations: [PatientDetailComponent, FollowUpFormComponent, AccessLinkComponent, AlertTableComponent,
        QuestionnaireFormComponent, PatientMedicalComponent, PatientContactsComponent, PatientTimelineComponent, PatientDocumentsComponent,
        PatientAuditComponent, MessageThreadComponent, StubNotificationsComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('ADMIN'), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }), get queryParamMap() { return convertToParamMap(query); } } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientDetailComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  function flushAll(data: { followUps?: any[]; checkIns?: any[]; alerts?: any[]; appointments?: any[]; rules?: any[]; medical?: any; careTeam?: any[]; inbox?: any[] } = {}, file = true) {
    if (file) {
      // the patient file loads once per visit (the medical call writes the "file viewed" audit row)
      http.expectOne(`${api}/patients/5/medical`).flush(data.medical ?? medical());
      http.expectOne(`${api}/patients/5/care-team`).flush(data.careTeam ?? []);
      http.expectOne(`${api}/messages/inbox`).flush(data.inbox ?? []);
    }
    http.expectOne(`${api}/patients/5`).flush(JANE);
    http.expectOne(`${api}/patients/5/follow-ups`).flush(data.followUps ?? []);
    http.expectOne(`${api}/patients/5/check-ins`).flush(data.checkIns ?? []);
    http.expectOne(`${api}/patients/5/alerts`).flush(data.alerts ?? []);
    http.expectOne(`${api}/patients/5/appointments`).flush(data.appointments ?? []);
    // the form definition (thresholds, items) is requested once per definition id (then cached)
    http.match(`${api}/questionnaires/7`).forEach(r => r.flush({ id: 7, title: { fr: 'a', en: 'b' }, questionnaire: FULL_Q, rules: data.rules ?? [] }));
    fixture.detectChanges();
  }

  function init(data: Parameters<typeof flushAll>[0] = {}) {
    fixture.detectChanges();
    flushAll(data);
  }

  it('makes the five page calls plus the three file calls on init', () => {
    fixture.detectChanges();
    expect(http.match(() => true).length).toBe(8);
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
    expect(discharge.max).toBe(businessToday());
    (el.querySelector('app-follow-up-form form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const post = http.expectOne(`${api}/patients/5/follow-ups`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.specialty).toBe('VISCERAL_SURGERY');
    expect(post.request.body.durationDays).toBe(7);
    post.flush({ followUp: followUp(), accessCode: code }, { status: 201, statusText: 'Created' });
    flushAll({ followUps: [followUp()] }, false);
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
    expect(el.querySelector('.field-error')!.textContent).toContain('must not be in the future');
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
    flushAll({ followUps: [followUp()] }, false);
    expect((el.querySelector('.access-link input') as HTMLInputElement).value).toContain('/q/' + code);
  });

  it('Copy link calls the clipboard', async () => {
    init({ followUps: [followUp()] });
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);
    (el.querySelector('#regenerate-link') as HTMLButtonElement).click();
    http.expectOne(`${api}/follow-ups/11/access-code`).flush({ followUp: followUp(), accessCode: code });
    flushAll({ followUps: [followUp()] }, false);
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
    flushAll({ followUps: [followUp({ status: 'CLOSED' })] }, false);
    expect(el.querySelector('app-follow-up-form')).not.toBeNull();
  });

  it('expanding a check-in fetches its definition once and renders it read-only', () => {
    init({ followUps: [followUp()], checkIns: [checkIn(3), checkIn(2)] });
    expect(el.querySelector('dl.q-readonly')).toBeNull();
    const buttons = el.querySelectorAll<HTMLButtonElement>('.btn-toggle');
    buttons[0].click();
    fixture.detectChanges();
    http.expectNone(`${api}/questionnaires/7`); // already fetched (and cached) for the charts
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
    expect(el.querySelector('app-alert-table .alert-row .chip__label')!.textContent).toBe('High');
    const apptLink = el.querySelector('.appointments ul a')!;
    expect(apptLink.getAttribute('href')).toBe('/appointments/4');
    expect(apptLink.textContent).toContain('08:30');
    expect(el.querySelector('.appointments .appt__date')!.textContent).toContain('Wed 14 Oct');
    expect(el.querySelector('.appointments .chip__label')!.textContent).toBe('Ready');
  });

  describe('patient file', () => {
    const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.tabs .tab'));
    const flushLazy = () => http.match(() => true).forEach(r => r.flush(
      r.request.url.includes('/audit') ? { items: [], page: 0, size: 50, hasMore: false } : r.request.url.endsWith('/settings/clinic') ? CLINIC : []));

    it('shows the ten tabs in order with counts only when above zero', () => {
      init({
        alerts: [alertDto()], appointments: [appointment()], checkIns: [checkIn(1)], followUps: [followUp()],
        inbox: [conversation({ patientId: 9, unreadCount: 4 }), conversation({ patientId: 5, unreadCount: 1 })]
      });
      expect(tabs().map(t => t.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
        'Overview', 'Medical', 'Contacts', 'Timeline', 'Documents', 'Messages 1', 'Check-ins 1', 'Alerts 1', 'Appointments 1', 'Access log'
      ]);
      expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('takes the unread count from the inbox and never opens the thread (that would write an audit row)', () => {
      init({ inbox: [conversation({ patientId: 5, unreadCount: 3 })] });
      http.expectNone(r => r.url === `${api}/patients/5/messages`);
      expect(tabs()[5].textContent!.replace(/\s+/g, ' ').trim()).toBe('Messages 3');
    });

    it('shows no count on a tab with nothing to show', () => {
      init();
      expect(tabs().map(t => t.textContent!.trim())).toEqual([
        'Overview', 'Medical', 'Contacts', 'Timeline', 'Documents', 'Messages', 'Check-ins', 'Alerts', 'Appointments', 'Access log'
      ]);
    });

    it('?tab=documents selects Documents and loads only that tab', () => {
      query = { tab: 'documents' };
      init();
      http.expectOne(`${api}/patients/5/documents`).flush([]);
      fixture.detectChanges();
      expect(tabs()[4].getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('#panel-documents')!.hasAttribute('hidden')).toBeFalse();
      expect(el.querySelector('#panel-timeline app-patient-timeline')).toBeNull(); // lazy: never opened
      expect(el.querySelector('#panel-audit app-patient-audit')).toBeNull();
    });

    it('arrow keys move between all ten tabs', () => {
      init();
      const list = el.querySelector('.tabs') as HTMLElement;
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      fixture.detectChanges();
      expect(tabs()[9].getAttribute('aria-selected')).toBe('true');
      flushLazy(); // the opened tab loads its data
    });

    it('shows the age and date of birth in the hero meta', () => {
      init({ medical: medical({ dateOfBirth: '1980-05-20' }) });
      const meta = el.querySelector('.profile-hero__meta')!.textContent!;
      expect(meta).toMatch(/ \d+ y \(born 20 May 1980\)/);
    });

    it('omits the age when the date of birth is unknown', () => {
      init({ medical: medical({ dateOfBirth: null }) });
      expect(el.querySelector('.profile-hero__meta')!.textContent).not.toContain('born');
    });

    it('a severe allergy shows a critical chip with the glyph and the word, titled with every substance', () => {
      init({ medical: medical({ allergies: [
        { ...medical().allergies[0], substance: 'Penicillin' },
        { ...medical().allergies[0], id: 2, substance: 'Latex', severity: 'MILD' }] }) });
      const holder = el.querySelector('.allergy-chip') as HTMLElement;
      const chip = holder.querySelector('.chip--critical')!;
      expect(chip.querySelector('.chip__glyph')!.textContent).toBe('▲');
      expect(chip.querySelector('.chip__label')!.textContent).toBe('Allergy: Penicillin');
      expect(holder.getAttribute('title')).toBe('Penicillin, Latex');
    });

    it('non-severe allergies show a warning count; no allergies show no chip', () => {
      init({ medical: medical({ allergies: [{ ...medical().allergies[0], severity: 'MILD' }] }) });
      expect(el.querySelector('.allergy-chip .chip--warning .chip__label')!.textContent).toBe('Allergies: 1');
    });

    it('does not show an allergy chip when none are recorded', () => {
      init({ medical: medical({ allergies: [] }) });
      expect(el.querySelector('.allergy-chip')).toBeNull();
    });

    it('calls the medical endpoint once per visit, not on a reload', () => {
      init({ followUps: [followUp()] });
      fixture.componentInstance.reload();
      flushAll({ followUps: [followUp()] }, false); // would fail on an unexpected /medical call at verify()
      expect(http.match(r => r.url.endsWith('/medical')).length).toBe(0);
    });

    it('lists the care team on the overview with an Inactive chip, and Manage opens Contacts', () => {
      init({ careTeam: [careTeamMember(), careTeamMember({ assignmentId: 10, staffId: 2, displayName: 'Sam Doc', role: 'PHYSICIAN', active: false })] });
      const card = el.querySelector('.care-team-card')!;
      expect(card.querySelectorAll('.row').length).toBe(2);
      expect(card.textContent).toContain('Marie Nurse');
      expect(card.textContent).toContain('Nurse');
      expect(card.querySelectorAll('.chip--neutral').length).toBe(1);
      expect(card.querySelector('.chip--neutral')!.textContent).toContain('Inactive');
      (card.querySelector('.card__link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
      flushLazy();
    });

    it('says so when no care team is assigned', () => {
      init();
      expect(el.querySelector('.care-team-card')!.textContent).toContain('No care team assigned.');
    });

    it('shows a retry banner inside the Medical tab when the medical call fails', () => {
      fixture.detectChanges();
      http.expectOne(`${api}/patients/5/medical`).flush('x', { status: 500, statusText: 'Server Error' });
      http.expectOne(`${api}/patients/5/care-team`).flush([]);
      http.expectOne(`${api}/messages/inbox`).flush([]);
      flushAll({}, false);
      expect(el.querySelector('#panel-medical .banner--error')!.textContent).toContain('Could not load the medical information');
    });
  });

  describe('charts', () => {
    const fu = followUp({ dischargeDate: addDays(businessToday(), -5), endDate: addDays(businessToday(), 2) });

    it('a failed definition request is announced as "Alert threshold unavailable", not "No alert rule"', () => {
      spyOn(console, 'warn');
      fixture.detectChanges();
      http.expectOne(`${api}/patients/5/medical`).flush(medical());
      http.expectOne(`${api}/patients/5/care-team`).flush([]);
      http.expectOne(`${api}/messages/inbox`).flush([]);
      http.expectOne(`${api}/patients/5`).flush(JANE);
      http.expectOne(`${api}/patients/5/follow-ups`).flush([fu]);
      http.expectOne(`${api}/patients/5/check-ins`).flush([]);
      http.expectOne(`${api}/patients/5/alerts`).flush([]);
      http.expectOne(`${api}/patients/5/appointments`).flush([]);
      fixture.detectChanges();
      expect(el.querySelector('.trend__caption')!.textContent).toContain('Loading alert threshold');
      http.expectOne(`${api}/questionnaires/7`).flush('boom', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el.querySelector('.trend__caption')!.textContent).toContain('Alert threshold unavailable');
      expect(el.querySelector('.trend__caption')!.textContent).not.toContain('No alert rule');
    });

    it('a CLOSED follow-up draws no missed stubs after its closure day', () => {
      const closed = { ...fu, status: 'CLOSED' as const, closedAt: addDays(businessToday(), -3) + 'T15:00:00Z' }; // day 2
      init({ followUps: [closed] });
      const missedDays = Array.from(el.querySelectorAll('.trends-card .bc-bar--miss')).length;
      expect(missedDays).toBeLessThanOrEqual(2); // days 1 and 2 only
      expect(el.querySelectorAll('.trends-card .bc-bar--miss').length).toBeGreaterThan(0);
    });
  });
});

describe('PatientDetailComponent by access role', () => {
  const api = environment.apiUrl;
  const today = businessToday();
  let fixture: ComponentFixture<PatientDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let query: Record<string, string> = {};
  let queryParams$ = new BehaviorSubject(convertToParamMap({}));

  const TABS: Record<AccessRole, string[]> = {
    ADMIN: ['Overview', 'Medical', 'Contacts', 'Timeline', 'Documents', 'Messages', 'Check-ins', 'Alerts', 'Appointments', 'Access log'],
    PHYSICIAN: ['Overview', 'Medical', 'Contacts', 'Timeline', 'Documents', 'Messages', 'Check-ins', 'Alerts', 'Appointments'],
    NURSE: ['Overview', 'Medical', 'Contacts', 'Timeline', 'Documents', 'Messages', 'Check-ins', 'Alerts', 'Appointments'],
    RECEPTION: ['Overview', 'Contacts', 'Appointments']
  };

  async function mount(role: AccessRole, q: Record<string, string> = {}, over: Parameters<typeof providePermissions>[1] = {}) {
    query = q;
    queryParams$ = new BehaviorSubject(convertToParamMap(q));
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule, SendLinkComponent, ActorSelectComponent],
      declarations: [PatientDetailComponent, FollowUpFormComponent, AccessLinkComponent, AlertTableComponent,
        QuestionnaireFormComponent, PatientMedicalComponent, PatientContactsComponent, PatientTimelineComponent, PatientDocumentsComponent,
        PatientAuditComponent, MessageThreadComponent, StubNotificationsComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions(role, over), { provide: ActivatedRoute, useValue: { queryParamMap: queryParams$.asObservable(), snapshot: { paramMap: convertToParamMap({ id: '5' }), get queryParamMap() { return convertToParamMap(query); } } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientDetailComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  afterEach(() => {
    // tabs opened by a test load their own data (contacts, access log): answer it so verify() checks the rest
    http.match(() => true).forEach(r => r.flush(r.request.url.includes('/audit') ? { items: [], page: 0, size: 50, hasMore: false } : []));
    http.verify();
  });

  /** Answers the calls a clinical member makes. */
  function flushClinical(data: { followUps?: object[]; alerts?: object[]; appointments?: object[]; careTeam?: object[] } = {}) {
    http.expectOne(`${api}/patients/5/medical`).flush(medical());
    http.expectOne(`${api}/patients/5/care-team`).flush(data.careTeam ?? []);
    http.expectOne(`${api}/messages/inbox`).flush([]);
    http.expectOne(`${api}/patients/5`).flush(JANE);
    http.expectOne(`${api}/patients/5/follow-ups`).flush(data.followUps ?? []);
    http.expectOne(`${api}/patients/5/check-ins`).flush([]);
    http.expectOne(`${api}/patients/5/alerts`).flush(data.alerts ?? []);
    http.expectOne(`${api}/patients/5/appointments`).flush(data.appointments ?? []);
    http.match(`${api}/questionnaires/7`).forEach(r => r.flush({ id: 7, title: { fr: 'a', en: 'b' }, questionnaire: FULL_Q, rules: [] }));
    fixture.detectChanges();
  }

  /** Answers the calls reception makes: the patient, the care team, the schedule and the contact preferences. */
  function flushReception(data: { appointments?: object[]; careTeam?: object[]; prefs?: object } = {}) {
    http.expectOne(`${api}/patients/5`).flush({ ...JANE, activeFollowUp: null, unresolvedAlertCount: null });
    http.expectOne(`${api}/patients/5/care-team`).flush(data.careTeam ?? []);
    http.expectOne(`${api}/patients/5/appointments`).flush(data.appointments ?? []);
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(data.prefs ?? contactPrefs());
    fixture.detectChanges();
  }

  const tabs = () => Array.from(el.querySelectorAll('[role=tab]')).map(t => t.textContent!.replace(/\s+/g, ' ').trim());
  const selected = () => el.querySelector('[role=tab][aria-selected=true]')!.textContent!.trim();
  const key = (k: string) => {
    el.querySelector('[role=tablist]')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    fixture.detectChanges();
  };

  for (const role of ['ADMIN', 'PHYSICIAN', 'NURSE', 'RECEPTION'] as AccessRole[]) {
    it(`${role} sees exactly these tabs: ${TABS[role].join(', ')}`, async () => {
      await mount(role);
      role === 'RECEPTION' ? flushReception() : flushClinical();
      expect(tabs()).toEqual(TABS[role]);
      expect(el.querySelectorAll('[role=tabpanel]').length).toBe(TABS[role].length);
    });
  }

  describe('RECEPTION', () => {
    it('makes no clinical request: no medical, follow-ups, check-ins, alerts or inbox', async () => {
      await mount('RECEPTION');
      const clinical = [`${api}/patients/5/medical`, `${api}/patients/5/follow-ups`, `${api}/patients/5/check-ins`, `${api}/patients/5/alerts`, `${api}/messages/inbox`];
      for (const u of clinical) {
        expect(http.match(u).length).withContext(u).toBe(0);
      }
      expect(http.match(r => r.url.startsWith(`${api}/questionnaires`)).length).toBe(0);
      flushReception();
    });

    it('a ?tab=medical deep link falls back to Overview', async () => {
      await mount('RECEPTION', { tab: 'medical' });
      flushReception();
      expect(selected()).toBe('Overview');
      expect(el.querySelector('app-patient-medical')).toBeNull();
    });

    it('a ?tab=contacts deep link opens Contacts', async () => {
      await mount('RECEPTION', { tab: 'contacts' });
      flushReception();
      expect(selected()).toBe('Contacts');
    });

    it('arrow keys, Home and End move over the three visible tabs only', async () => {
      await mount('RECEPTION');
      flushReception();
      key('ArrowRight');
      expect(selected()).toBe('Contacts');
      key('ArrowRight');
      expect(selected()).toBe('Appointments');
      key('ArrowRight');
      expect(selected()).toBe('Overview');
      key('ArrowLeft');
      expect(selected()).toBe('Appointments');
      key('Home');
      expect(selected()).toBe('Overview');
      key('End');
      expect(selected()).toBe('Appointments');
    });

    it('the overview shows demographics, the care team read-only, upcoming appointments and the reminders line', async () => {
      await mount('RECEPTION');
      flushReception({
        careTeam: [careTeamMember()],
        appointments: [appointment({ id: 4, scheduledAt: addDays(today, 2) + 'T09:00:00' }), appointment({ id: 5, scheduledAt: addDays(today, -2) + 'T09:00:00', status: 'COMPLETED' })],
        prefs: contactPrefs({ contactConsent: 'GRANTED', preferredChannel: 'SMS', effectiveLanguage: 'FR' })
      });
      expect(el.querySelector('.demographics')!.textContent).toContain('jane@example.com');
      expect(el.querySelector('.care-team-card')!.textContent).toContain('Marie Nurse');
      expect(el.querySelector('.care-team-card .card__link')).toBeNull(); // "Manage" needs CLINICAL_WRITE
      expect(Array.from(el.querySelectorAll('.upcoming-card .row')).length).toBe(1);
      expect(el.querySelector('.notif-summary__line')!.textContent).toBe('Reminders: consent granted, SMS, French');
      (el.querySelector('.notif-summary .card__link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(selected()).toBe('Contacts');
    });

    it('switches tab when ?tab= changes after init, and ignores tabs it may not show', async () => {
      await mount('RECEPTION');
      flushReception();
      expect(selected()).toBe('Overview');
      queryParams$.next(convertToParamMap({ tab: 'contacts' }));
      fixture.detectChanges();
      expect(selected()).toBe('Contacts');
      queryParams$.next(convertToParamMap({ tab: 'medical' }));
      fixture.detectChanges();
      expect(selected()).toBe('Contacts');
    });

    it('uses a single-column overview and updates the reminders line when the preferences are saved', async () => {
      await mount('RECEPTION');
      flushReception({ prefs: contactPrefs({ contactConsent: 'UNKNOWN', preferredChannel: 'EMAIL', effectiveLanguage: 'EN' }) });
      expect(el.querySelector('.overview-grid')!.classList).toContain('overview-grid--single');
      expect(el.querySelectorAll('.overview-grid > .stack-20').length).toBe(1);
      expect(el.querySelector('.notif-summary__line')!.textContent).toBe('Reminders: consent not recorded, email, English');
      (queryParams$ as BehaviorSubject<any>).next(convertToParamMap({ tab: 'contacts' }));
      fixture.detectChanges();
      const stub = fixture.debugElement.query(By.directive(StubNotificationsComponent)).componentInstance as StubNotificationsComponent;
      stub.saved.emit(contactPrefs({ contactConsent: 'GRANTED', preferredChannel: 'SMS', effectiveLanguage: 'FR' }));
      fixture.detectChanges();
      expect(el.querySelector('.notif-summary__line')!.textContent).toBe('Reminders: consent granted, SMS, French');
    });

    it('hides the trends, recent alerts, follow-up card, allergy chip and the clinical summary tiles', async () => {
      await mount('RECEPTION');
      flushReception();
      for (const sel of ['.trends-card', '.recent-alerts', '.follow-up-card', '.allergy-chip', '#regenerate-link', '#close-follow-up', 'app-follow-up-form', 'app-send-link', '.profile-hero .chip']) {
        expect(el.querySelector(sel)).withContext(sel).toBeNull();
      }
      expect(el.querySelectorAll('.kpis--summary .kpi').length).toBe(1); // next appointment only
      expect(el.querySelector('.kpis--summary')!.textContent).toContain('Next appointment');
    });

    it('keeps New appointment (APPOINTMENT_WRITE)', async () => {
      await mount('RECEPTION');
      flushReception();
      expect(Array.from(el.querySelectorAll('a')).some(a => a.textContent!.includes('New appointment'))).toBeTrue();
    });

    it('the notifications line stays out when the preferences cannot be loaded', async () => {
      await mount('RECEPTION');
      http.expectOne(`${api}/patients/5`).flush(JANE);
      http.expectOne(`${api}/patients/5/care-team`).flush([]);
      http.expectOne(`${api}/patients/5/appointments`).flush([]);
      http.expectOne(`${api}/patients/5/contact-preferences`).flush('x', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el.querySelector('.notif-summary')).toBeNull();
    });
  });

  describe('clinical members', () => {
    it('NURSE: a ?tab=audit deep link falls back to Overview', async () => {
      await mount('NURSE', { tab: 'audit' });
      flushClinical();
      expect(selected()).toBe('Overview');
    });

    it('NURSE: arrow keys wrap over the nine visible tabs (no Access log)', async () => {
      await mount('NURSE');
      flushClinical();
      key('End');
      expect(selected()).toBe('Appointments');
      key('ArrowRight');
      expect(selected()).toBe('Overview');
      key('ArrowLeft');
      expect(selected()).toBe('Appointments');
    });

    it('ADMIN: End reaches the Access log', async () => {
      await mount('ADMIN');
      flushClinical();
      key('End');
      expect(selected()).toBe('Access log');
    });

    it('NURSE sees Regenerate, Close, Send link and the enroll form where they apply', async () => {
      await mount('NURSE');
      flushClinical({ followUps: [followUp()] });
      expect(el.querySelector('#regenerate-link')).not.toBeNull();
      expect(el.querySelector('#close-follow-up')).not.toBeNull();
      const send = el.querySelector('.follow-up-card app-send-link')!;
      expect(send.querySelector('.send-link__btn')!.textContent).toContain('Send link');
      expect(el.querySelector('app-follow-up-form')).toBeNull();
    });

    it('no Send link on an EXPIRED follow-up, which offers enrolment again', async () => {
      await mount('NURSE');
      flushClinical({ followUps: [followUp({ status: 'EXPIRED' })] });
      expect(el.querySelector('app-send-link')).toBeNull();
      expect(el.querySelector('#regenerate-link')).toBeNull();
      expect(el.querySelector('app-follow-up-form')).not.toBeNull();
    });

    it('Send link opens the channel menu from the follow-up card (preferences load on click)', async () => {
      await mount('NURSE');
      flushClinical({ followUps: [followUp()] });
      (el.querySelector('.follow-up-card .send-link__btn') as HTMLButtonElement).click();
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs({ preferredChannel: 'SMS' }));
      fixture.detectChanges();
      expect(Array.from(el.querySelectorAll('.send-link__item')).map(i => i.textContent!.trim())).toEqual(['By SMS (preferred)', 'By email']);
    });

    it('hides the write buttons from a member who can read but not write clinically', async () => {
      await mount('NURSE', {}, { permissions: ['PATIENT_READ', 'CLINICAL_READ', 'APPOINTMENT_READ'] });
      flushClinical({ followUps: [followUp()], careTeam: [careTeamMember()] });
      for (const sel of ['#regenerate-link', '#close-follow-up', 'app-send-link', 'app-follow-up-form', '.care-team-card .card__link', '.profile-hero a.btn--accent']) {
        expect(el.querySelector(sel)).withContext(sel).toBeNull();
      }
      expect(tabs()).toEqual(['Overview', 'Medical', 'Contacts', 'Timeline', 'Documents', 'Messages', 'Check-ins', 'Alerts', 'Appointments']);
    });

    it('renders a missed check-in alert in Recent alerts without a question or answer value', async () => {
      await mount('NURSE');
      flushClinical({ alerts: [missedAlert({ missedDate: '2026-10-13' }), alertDto({ id: 3, questionLabel: 'Pain level?', answerValue: '8' })] });
      const lines = Array.from(el.querySelectorAll('.recent-alerts .alert-line')).map(l => l.textContent!.replace(/\s+/g, ' ').trim());
      expect(lines[0]).toContain('Missed check-in');
      expect(lines[0]).toContain('Answer —');
      expect(lines[0]).toContain('13 Oct');
      expect(lines[1]).toContain('Pain level?');
      expect(lines[1]).toContain('Answer 8');
    });
  });
});
