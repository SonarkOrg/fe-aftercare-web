import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { QuestionnaireFormComponent } from '../../fhir/questionnaire-form/questionnaire-form.component';
import { AppointmentDetail } from '../../models/appointment.model';
import { AccessLinkComponent } from '../../shared/access-link/access-link.component';
import { AppointmentBadgeComponent } from '../../shared/appointment-badge/appointment-badge.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { FULL_Q, appointmentDetail } from '../../testing/fixtures';
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
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AppointmentDetailComponent, AppointmentBadgeComponent, QuestionnaireFormComponent, AccessLinkComponent, HeaderComponent],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '4' }) } } }]
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
    expect(el.querySelector('.badge')!.textContent).toBe('Needs review');
    expect(el.querySelector('.flag')!.textContent).toBe('Do you have a fever? — Recent illness or fever');
    const dl = el.querySelector('dl.q-readonly')!;
    expect(dl.textContent).toContain('Pain level?');
    expect(dl.textContent).toContain('6');
    expect(dl.textContent).toContain('Yes');
    expect(el.textContent).not.toContain('Not submitted yet.');
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
