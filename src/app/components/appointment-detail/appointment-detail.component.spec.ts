import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { AppointmentDetail } from '../../models/appointment.model';
import { AccessLinkComponent } from '../../shared/access-link/access-link.component';
import { FULL_Q, appointmentDetail, contactPrefs, notification, providePermissions } from '../../testing/fixtures';
import { AccessRole } from '../../models/me.model';
import { addDays, businessToday } from '../../shared/link.util';
import { SendLinkComponent } from '../../shared/send-link/send-link.component';
import { AppointmentDetailComponent } from './appointment-detail.component';

describe('AppointmentDetailComponent', () => {
  let fixture: ComponentFixture<AppointmentDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const url = `${api}/appointments/4`;

  const withIntake = (over: Partial<AppointmentDetail> = {}) => appointmentDetail({
    status: 'NEEDS_REVIEW', flagCount: 1, intakeSubmittedAt: '2026-10-12T15:00:00Z',
    intake: {
      submittedAt: '2026-10-12T15:00:00Z', questionnaireDefinitionId: 9, questionnaireUrl: FULL_Q.url, questionnaireVersion: '1',
      response: {
        resourceType: 'QuestionnaireResponse', questionnaire: FULL_Q.url + '|1', status: 'completed',
        item: [{ linkId: 'PAIN', answer: [{ valueInteger: 6 }] }, { linkId: 'FEVER', answer: [{ valueBoolean: true }] }]
      },
      flags: [{ linkId: 'FEVER', label: 'Do you have a fever?', message: 'Recent illness or fever', messageFr: 'Maladie récente' }]
    },
    ...over
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, SendLinkComponent],
      declarations: [AppointmentDetailComponent, QuestionnaireFormComponent, AccessLinkComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '4' }) } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppointmentDetailComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  function init(detail: AppointmentDetail) {
    fixture.detectChanges();
    http.expectOne(url).flush(detail);
    if (detail.intake) {
      http.expectOne(`${api}/questionnaires/9`).flush({ id: 9, title: { fr: 'a', en: 'b' }, questionnaire: FULL_Q, rules: [] });
    }
    fixture.detectChanges();
  }

  const has = (id: string) => el.querySelector('#' + id) !== null;

  it('shows the header, flags, read-only answers and the badge for an intake', () => {
    init(withIntake());
    expect(el.textContent).toContain('Jane Doe');
    expect(el.textContent).toContain('Pre op consult');
    expect(el.textContent).toContain('2026-10-14');
    expect(el.textContent).toContain('08:30');
    expect(el.textContent).toContain('30 min');
    expect(el.textContent).toContain('Clinic A');
    expect(el.textContent).toContain('Dr. Roy');
    expect(el.textContent).toContain('https://aftercare.example/fhir/Questionnaire/pre-consult|1');
    expect(el.querySelector('.chip__label')!.textContent).toBe('Needs review');
    expect(el.querySelector('.flag')!.textContent).toContain('Do you have a fever? — Recent illness or fever');
    const dl = el.querySelector('dl.q-readonly')!;
    expect(dl.textContent).toContain('Pain level?');
    expect(dl.textContent).toContain('6');
    expect(dl.textContent).toContain('Yes');
    expect(el.textContent).not.toContain('Not submitted yet.');
  });

  it('leaves out the Specialty row when it is redacted (null)', () => {
    init(appointmentDetail({ specialty: null }));
    expect(el.textContent).toContain('Pre op consult');
    expect(el.textContent).not.toContain('Specialty');
    expect(el.textContent).not.toMatch(/null|undefined/);
  });

  it('says so when no issues were flagged', () => {
    const d = withIntake();
    d.intake!.flags = [];
    init(d);
    expect(el.textContent).toContain('No issues flagged.');
  });

  it('NEEDS_REVIEW offers Mark reviewed, cancel/complete/no-show and edit; no delete', () => {
    init(withIntake());
    for (const id of ['mark-reviewed', 'cancel-appt', 'complete-appt', 'no-show-appt', 'edit-appt']) {
      expect(has(id)).withContext(id).toBeTrue();
    }
    expect(has('delete-appt')).toBeFalse();
    expect(has('regenerate-link')).toBeFalse();
  });

  it('SCHEDULED without intake offers regenerate and delete, but not Mark reviewed', () => {
    init(appointmentDetail());
    expect(el.textContent).toContain('Not submitted yet.');
    expect(has('regenerate-link')).toBeTrue();
    expect(has('delete-appt')).toBeTrue();
    expect(has('mark-reviewed')).toBeFalse();
    expect(has('cancel-appt')).toBeTrue();
  });

  it('READY has no Mark reviewed; COMPLETED/CANCELLED/NO_SHOW have no actions', () => {
    init(withIntake({ status: 'READY', flagCount: 0 }));
    expect(has('mark-reviewed')).toBeFalse();
    expect(has('complete-appt')).toBeTrue();
  });

  for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
    it(`${status} shows no action buttons`, () => {
      init(appointmentDetail({ status }));
      for (const id of ['mark-reviewed', 'cancel-appt', 'complete-appt', 'no-show-appt', 'edit-appt', 'delete-appt', 'regenerate-link']) {
        expect(has(id)).withContext(id).toBeFalse();
      }
    });
  }

  it('Mark reviewed POSTs and reloads', () => {
    init(withIntake());
    (el.querySelector('#mark-reviewed') as HTMLButtonElement).click();
    const req = http.expectOne(`${url}/review`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
    http.expectOne(url).flush(withIntake({ status: 'READY' }));
    // definition is cached, so no second questionnaire request is issued
    fixture.detectChanges();
    expect(has('mark-reviewed')).toBeFalse();
  });

  const statusCases: [string, string][] = [['cancel-appt', 'CANCELLED'], ['complete-appt', 'COMPLETED'], ['no-show-appt', 'NO_SHOW']];
  for (const [btn, status] of statusCases) {
    it(`${btn} is confirm-guarded and POSTs { status: '${status}' }`, () => {
      init(appointmentDetail());
      const confirmSpy = spyOn(window, 'confirm').and.returnValue(false);
      (el.querySelector('#' + btn) as HTMLButtonElement).click();
      http.expectNone(`${url}/status`);
      confirmSpy.and.returnValue(true);
      (el.querySelector('#' + btn) as HTMLButtonElement).click();
      const req = http.expectOne(`${url}/status`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ status });
      req.flush({});
      http.expectOne(url).flush(appointmentDetail({ status: status as any }));
    });
  }

  it('regenerate shows the new link after confirming', () => {
    init(appointmentDetail());
    spyOn(window, 'confirm').and.returnValue(true);
    (el.querySelector('#regenerate-link') as HTMLButtonElement).click();
    http.expectOne(`${url}/access-code`).flush({ appointment: appointmentDetail(), accessCode: 'ZZZ' });
    http.expectOne(url).flush(appointmentDetail());
    fixture.detectChanges();
    expect((el.querySelector('.access-link input') as HTMLInputElement).value).toContain('/q/ZZZ');
  });

  it('delete DELETEs and navigates to the list', () => {
    init(appointmentDetail());
    spyOn(window, 'confirm').and.returnValue(true);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (el.querySelector('#delete-appt') as HTMLButtonElement).click();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(navigate).toHaveBeenCalledWith(['/appointments']);
  });

  it('shows "Appointment not found." on 404', () => {
    fixture.detectChanges();
    http.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Appointment not found.');
  });
});

describe('AppointmentDetailComponent by access role', () => {
  const api = environment.apiUrl;
  const url = `${api}/appointments/4`;
  let fixture: ComponentFixture<AppointmentDetailComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  async function mount(role: AccessRole, detail: AppointmentDetail, over: Parameters<typeof providePermissions>[1] = {}) {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, SendLinkComponent],
      declarations: [AppointmentDetailComponent, QuestionnaireFormComponent, AccessLinkComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions(role, over), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '4' }) } } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppointmentDetailComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(url).flush(detail);
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  const future = () => `${addDays(businessToday(), 3)}T09:00:00`;
  const past = () => `${addDays(businessToday(), -3)}T09:00:00`;
  const has = (sel: string) => el.querySelector(sel) !== null;

  describe('RECEPTION (intake redacted)', () => {
    const redacted = (over: Partial<AppointmentDetail> = {}) => appointmentDetail({
      status: 'NEEDS_REVIEW', scheduledAt: future(), flagCount: 2, intakeSubmittedAt: '2026-10-12T15:00:00Z', intake: null, intakeRedacted: true, ...over
    });

    it('replaces the answers and flags with an info banner, keeping the submission time and the flag count', async () => {
      await mount('RECEPTION', redacted());
      http.expectNone(r => r.url.startsWith(`${api}/questionnaires`));
      expect(el.querySelector('.intake-redacted')!.textContent).toContain('Questionnaire answers are visible to clinical staff only.');
      expect(el.querySelector('.intake-redacted')!.classList).toContain('banner--info');
      expect(el.querySelector('.intake')!.textContent).toMatch(/Submitted 2026-10-1[23] \d\d:\d\d/);
      expect(el.querySelector('.flag-count')!.textContent).toBe('2 flag(s) for review');
      for (const sel of ['.flags', 'app-questionnaire-form', 'dl.q-readonly']) {
        expect(has(sel)).withContext(sel).toBeFalse();
      }
      expect(el.textContent).not.toContain('Not submitted yet.');
    });

    it('says "Not submitted yet." and shows no flag line when nothing was submitted', async () => {
      await mount('RECEPTION', redacted({ intakeSubmittedAt: null, flagCount: 0, status: 'SCHEDULED' }));
      expect(el.querySelector('.intake')!.textContent).toContain('Not submitted yet.');
      expect(has('.flag-count')).toBeFalse();
    });

    it('has no Mark reviewed, but keeps the scheduling actions (edit, cancel, complete, no-show) and Send link', async () => {
      await mount('RECEPTION', redacted());
      expect(has('#mark-reviewed')).toBeFalse();
      for (const id of ['cancel-appt', 'complete-appt', 'no-show-appt', 'edit-appt']) {
        expect(has('#' + id)).withContext(id).toBeTrue();
      }
      expect(has('app-send-link')).toBeTrue();
    });

    it('does not offer Delete for a submitted (redacted) intake', async () => {
      await mount('RECEPTION', redacted({ status: 'SCHEDULED' }));
      expect(has('#delete-appt')).toBeFalse();
    });
  });

  describe('NURSE', () => {
    it('sees Mark reviewed on NEEDS_REVIEW', async () => {
      await mount('NURSE', appointmentDetail({ status: 'NEEDS_REVIEW', scheduledAt: future() }));
      expect(has('#mark-reviewed')).toBeTrue();
    });

    it('Send link is shown for a usable (open, future) appointment', async () => {
      await mount('NURSE', appointmentDetail({ status: 'SCHEDULED', scheduledAt: future() }));
      expect(el.querySelector('app-send-link .send-link__btn')!.textContent).toContain('Send link');
    });

    it('Send link opens its menu and posts to the appointment endpoint', async () => {
      await mount('NURSE', appointmentDetail({ status: 'READY', scheduledAt: future() }));
      (el.querySelector('.send-link__btn') as HTMLButtonElement).click();
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'GRANTED' }));
      fixture.detectChanges();
      (el.querySelector('.send-link__item') as HTMLButtonElement).click();
      const r = http.expectOne(`${api}/appointments/4/send-link`);
      expect(r.request.body).toEqual({ channel: null });
      r.flush(notification({ template: 'APPOINTMENT_LINK', status: 'PENDING', recipientMasked: null }), { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();
      expect(el.querySelector('.send-link__ok')!.textContent).toContain('Link queued for email to the patient.');
    });

    for (const status of ['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const) {
      it(`no Send link for a ${status} appointment`, async () => {
        await mount('NURSE', appointmentDetail({ status, scheduledAt: future() }));
        expect(has('app-send-link')).toBeFalse();
      });
    }

    it('no Send link once the appointment time has passed', async () => {
      await mount('NURSE', appointmentDetail({ status: 'SCHEDULED', scheduledAt: past() }));
      expect(has('app-send-link')).toBeFalse();
    });
  });

  it('a member without APPOINTMENT_WRITE sees no actions and no Send link, and one without CLINICAL_WRITE no Mark reviewed', async () => {
    await mount('NURSE', appointmentDetail({ status: 'NEEDS_REVIEW', scheduledAt: future() }), { permissions: ['APPOINTMENT_READ', 'CLINICAL_READ'] });
    for (const sel of ['#mark-reviewed', '#cancel-appt', '#complete-appt', '#no-show-appt', '#edit-appt', '#delete-appt', 'app-send-link', '#regenerate-link']) {
      expect(has(sel)).withContext(sel).toBeFalse();
    }
  });

  it('a 403 on an action shows the permission text', async () => {
    await mount('NURSE', appointmentDetail({ status: 'NEEDS_REVIEW', scheduledAt: future() }));
    (el.querySelector('#mark-reviewed') as HTMLButtonElement).click();
    http.expectOne(`${url}/review`).flush({ status: 403, error: 'FORBIDDEN', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(url).flush(appointmentDetail({ status: 'NEEDS_REVIEW', scheduledAt: future() }));
    fixture.detectChanges();
    expect(el.querySelector('.error-message')!.textContent).toContain("You don't have permission for this action.");
  });
});
