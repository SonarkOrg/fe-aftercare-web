import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { Patient } from '../../models/patient.model';
import { AccessLinkComponent } from '../../shared/access-link/access-link.component';
import { JANE, appointment, appointmentDetail } from '../../testing/fixtures';
import { AppointmentFormComponent } from './appointment-form.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('AppointmentFormComponent', () => {
  let fixture: ComponentFixture<AppointmentFormComponent>;
  let component: AppointmentFormComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const code = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

  function setup(params: Record<string, string>, query: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [AppointmentFormComponent, AccessLinkComponent, ...SHARED_DECLARATIONS],
      providers: [{
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(params), queryParamMap: convertToParamMap(query) } }
      }]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppointmentFormComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  }

  afterEach(() => http.verify());

  it('preselects the patient from the query param and creates with a Toronto-local scheduledAt', async () => {
    setup({}, { patientId: '5' });
    fixture.detectChanges();
    http.expectOne(`${api}/patients`).flush([JANE, { ...JANE, id: 6, firstName: 'Bob' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const select = el.querySelector('#ap-patient') as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toContain('Jane Doe');
    expect(component.patientId).toBe(5);

    component.type = 'SURGERY';
    component.specialty = 'ORTHOPEDIC_SURGERY';
    component.date = '2026-10-16';
    component.time = '08:00';
    component.durationMinutes = 60;
    component.location = ' Bloc 2 ';
    component.clinician = '';
    component.submit();
    const req = http.expectOne(`${api}/appointments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      patientId: 5, type: 'SURGERY', specialty: 'ORTHOPEDIC_SURGERY', scheduledAt: '2026-10-16T08:00:00',
      durationMinutes: 60, location: 'Bloc 2', clinician: null
    });
    req.flush({ appointment: appointment({ id: 9 }), accessCode: code }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(el.textContent).toContain('Appointment created.');
    expect((el.querySelector('.access-link input') as HTMLInputElement).value).toContain('/q/' + code);
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('#go-to-appointment')!.getAttribute('href')).toBe('/appointments/9');
  });

  it('requires a patient', () => {
    setup({}, {});
    fixture.detectChanges();
    http.expectOne(`${api}/patients`).flush([JANE]);
    component.submit();
    http.expectNone(`${api}/appointments`);
    expect(component.error).toBe('Select a patient.');
  });

  it('shows 400 field errors and the 409 messages', () => {
    setup({}, { patientId: '5' });
    fixture.detectChanges();
    http.expectOne(`${api}/patients`).flush([JANE]);

    component.submit();
    http.expectOne(`${api}/appointments`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { scheduledAt: 'must be in the future' } },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Date and time: Must be in the future.');

    component.submit();
    http.expectOne(`${api}/appointments`).flush(
      { status: 409, error: 'NO_ACTIVE_QUESTIONNAIRE', message: '', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain('No active questionnaire for this appointment type.');

    component.submit();
    http.expectOne(`${api}/appointments`).flush(
      { status: 409, error: 'INVALID_STATE', message: '', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain('This appointment can no longer be edited.');
  });

  it('edit mode loads the appointment, disables the patient, PUTs and navigates to the detail page', async () => {
    setup({ id: '4' }, {});
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    http.expectOne(`${api}/appointments/4`).flush(appointmentDetail({ scheduledAt: '2026-10-14T08:30:00', durationMinutes: 45, clinician: null }));
    http.expectOne(`${api}/patients`).flush([JANE]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((el.querySelector('#ap-patient') as HTMLSelectElement).disabled).toBeTrue();
    expect((el.querySelector('#ap-date') as HTMLInputElement).value).toBe('2026-10-14');
    expect((el.querySelector('#ap-time') as HTMLInputElement).value).toBe('08:30');
    expect(el.querySelector('h1')!.textContent).toContain('Edit appointment');

    component.time = '09:00';
    component.submit();
    const req = http.expectOne(`${api}/appointments/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.scheduledAt).toBe('2026-10-14T09:00:00');
    expect('patientId' in req.request.body).toBeFalse();
    expect(req.request.body.durationMinutes).toBe(45);
    req.flush(appointment({ scheduledAt: '2026-10-14T09:00:00' }));
    expect(navigate).toHaveBeenCalledWith(['/appointments', 4]);
  });

  it('edit mode with a failed GET shows only the error, no form', () => {
    setup({ id: '4' }, {});
    fixture.detectChanges();
    http.expectOne(`${api}/appointments/4`).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(`${api}/patients`).flush([JANE]);
    fixture.detectChanges();
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('#load-error')!.textContent).toContain('Server error. Please try again later.');
  });

  describe('clinic messages (consent) fieldset', () => {
    const unknown: Patient = { ...JANE, contactConsent: 'UNKNOWN' };

    async function ready(patient: Patient = unknown) {
      setup({}, { patientId: '5' });
      fixture.detectChanges();
      http.expectOne(`${api}/patients`).flush([patient]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }
    const radios = () => Array.from(el.querySelectorAll('#ap-consent input[type=radio]')) as HTMLInputElement[];

    it('shows three radios, "Not asked yet" selected, when the patient consent is UNKNOWN (create mode)', async () => {
      await ready();
      expect(el.querySelector('#ap-consent legend')!.textContent).toBe('Clinic messages');
      expect(radios().map(r => r.parentElement!.textContent!.trim())).toEqual(['Accepts', 'Refuses', 'Not asked yet']);
      expect(radios().map(r => r.checked)).toEqual([false, false, true]);
    });

    it('is absent when consent is already answered, when the list has no consent field, and in edit mode', async () => {
      await ready({ ...JANE, contactConsent: 'GRANTED' });
      expect(el.querySelector('#ap-consent')).toBeNull();
    });

    it('is absent for a patient without the member (older payload)', async () => {
      await ready(JANE);
      expect(el.querySelector('#ap-consent')).toBeNull();
    });

    it('is absent in edit mode', async () => {
      setup({ id: '4' }, {});
      fixture.detectChanges();
      http.expectOne(`${api}/appointments/4`).flush(appointmentDetail());
      http.expectOne(`${api}/patients`).flush([unknown]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('#ap-consent')).toBeNull();
    });

    it('"Not asked yet" behaves as today: no consent call, one POST', async () => {
      await ready();
      component.submit();
      const req = http.expectOne(`${api}/appointments`);
      expect(req.request.method).toBe('POST');
      req.flush({ appointment: appointment(), accessCode: code });
    });

    it('"Accepts" sends PUT contact-consent GRANTED first, then POST /appointments', async () => {
      await ready();
      radios()[0].click();
      fixture.detectChanges();
      component.submit();
      http.expectNone(`${api}/appointments`);
      const put = http.expectOne(`${api}/patients/5/contact-consent`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ contactConsent: 'GRANTED' });
      http.expectNone(`${api}/appointments`);
      put.flush({ contactConsent: 'GRANTED' });
      const post = http.expectOne(`${api}/appointments`);
      expect(post.request.method).toBe('POST');
      post.flush({ appointment: appointment(), accessCode: code });
      fixture.detectChanges();
      expect(el.querySelector('.created')).not.toBeNull();
    });

    it('"Refuses" sends WITHDRAWN', async () => {
      await ready();
      radios()[1].click();
      fixture.detectChanges();
      component.submit();
      const put = http.expectOne(`${api}/patients/5/contact-consent`);
      expect(put.request.body).toEqual({ contactConsent: 'WITHDRAWN' });
      put.flush({ contactConsent: 'WITHDRAWN' });
      http.expectOne(`${api}/appointments`).flush({ appointment: appointment(), accessCode: code });
    });

    it('consent saved but create refused: both are said, and a retry sends no second consent call', async () => {
      await ready();
      radios()[0].click();
      fixture.detectChanges();
      component.submit();
      http.expectOne(`${api}/patients/5/contact-consent`).flush({ contactConsent: 'GRANTED' });
      http.expectOne(`${api}/appointments`).flush({ status: 409, error: 'NO_ACTIVE_QUESTIONNAIRE', message: 'x', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(component.created).toBeNull();
      expect(el.querySelector('.error-message')).not.toBeNull();
      expect(el.querySelector('.consent-saved')!.textContent).toContain('The answer about clinic messages is saved in the file');
      expect(el.querySelector('#ap-consent')).toBeNull();
      component.submit();
      http.expectNone(`${api}/patients/5/contact-consent`);
      http.expectOne(`${api}/appointments`).flush({ appointment: appointment(), accessCode: code });
    });

    it('a failed consent call creates nothing and shows the error', async () => {
      await ready();
      radios()[0].click();
      fixture.detectChanges();
      component.submit();
      http.expectOne(`${api}/patients/5/contact-consent`).flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      http.expectNone(`${api}/appointments`);
      expect(component.created).toBeNull();
      expect(component.saving).toBeFalse();
      expect(el.querySelector('.error-message')).not.toBeNull();
      expect(el.querySelector('form')).not.toBeNull();
    });

    it('changing the patient resets the choice to "Not asked yet"', async () => {
      await ready();
      radios()[0].click();
      fixture.detectChanges();
      expect(component.consentChoice).toBe('GRANTED');
      component.patientChanged();
      expect(component.consentChoice).toBe('UNKNOWN');
    });
  });
});
