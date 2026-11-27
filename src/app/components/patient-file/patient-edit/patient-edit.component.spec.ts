import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Patient } from '../../../models/patient.model';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';
import { JANE, contactPrefs, provideCollection, providePermissions } from '../../../testing/fixtures';
import { PatientEditComponent, PatientEditResult } from './patient-edit.component';
import { throwError } from 'rxjs';
import { SettingsService } from '../../../Services/Settings.service';

describe('PatientEditComponent', () => {
  let fixture: ComponentFixture<PatientEditComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const patient: Patient = { ...JANE, dateOfBirth: '1980-05-20' };
  let saved: PatientEditResult[];
  let closed: number;
  let trigger: HTMLButtonElement;

  const input = (id: string) => el.querySelector('#' + id) as HTMLInputElement;
  function type(id: string, value: string) {
    const i = input(id);
    i.value = value;
    i.dispatchEvent(new Event('input'));
    i.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
  const submit = () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  async function open(consent: 'GRANTED' | 'UNKNOWN' | 'WITHDRAWN' = 'UNKNOWN') {
    fixture.detectChanges();
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: consent }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    saved = [];
    closed = 0;
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule],
      declarations: [PatientEditComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('RECEPTION'), provideCollection(true, true)]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    trigger = document.createElement('button');
    document.body.appendChild(trigger);
    fixture = TestBed.createComponent(PatientEditComponent);
    fixture.componentInstance.patient = patient;
    fixture.componentInstance.trigger = trigger;
    fixture.componentInstance.saved.subscribe(r => saved.push(r));
    fixture.componentInstance.closed.subscribe(() => closed++);
    el = fixture.nativeElement;
  });

  afterEach(() => {
    http.verify();
    trigger.remove();
    fixture.destroy();
  });

  it('prefills the form from the patient, including the date of birth', async () => {
    await open();
    expect(input('edit-firstName').value).toBe('Jane');
    expect(input('edit-email').value).toBe('jane@example.com');
    expect(input('edit-dob').value).toBe('1980-05-20');
    expect(input('edit-city').value).toBe('Springfield');
    expect(document.body.classList.contains('drawer-open')).toBeTrue();
  });

  it('focuses the first field on open', async () => {
    await open();
    await new Promise(r => setTimeout(r));
    expect(document.activeElement).toBe(input('edit-firstName'));
  });

  it('sends the complete patient, including untouched fields such as the date of birth', async () => {
    await open();
    type('edit-city', ' Montréal ');
    submit();
    const put = http.expectOne(`${api}/patients/5`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      id: 5, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-0100', gender: 'female',
      dateOfBirth: '1980-05-20', address: { city: 'Montréal', state: 'IL', zip: '62701' }
    });
    put.flush({ ...put.request.body });
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs());
    expect(saved.length).toBe(1);
    expect(saved[0].patient.address!.city).toBe('Montréal');
    expect(saved[0].contactChanged).toBeFalse();
    expect(saved[0].prefs).not.toBeNull();
    expect(closed).toBe(1);
  });

  it('sends a null date of birth when the patient has none', async () => {
    fixture.componentInstance.patient = { ...JANE };
    await open();
    submit();
    const put = http.expectOne(`${api}/patients/5`);
    expect(put.request.body.dateOfBirth).toBeNull();
    put.flush(put.request.body);
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs());
  });

  it('blocks a save with client errors that mirror the server rules and sends nothing', async () => {
    await open();
    type('edit-firstName', '   ');
    type('edit-email', 'not-an-email');
    type('edit-lastName', 'x'.repeat(256));
    type('edit-dob', '1899-12-31');
    submit();
    http.expectNone(`${api}/patients/5`);
    expect(el.textContent).toContain('This field is required.');
    expect(el.textContent).toContain('Enter a valid email address.');
    expect(el.textContent).toContain('At most 255 characters.');
    expect(el.textContent).toContain('Must not be before 1900-01-01.');
    expect(input('edit-firstName').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('edit-firstName'));
  });

  describe('a patient with only a first and a last name', () => {
    const MINIMAL: Patient = { id: 5, firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, address: null, dateOfBirth: null };

    it('opens with empty fields and an empty gender choice, never the word null', async () => {
      fixture.componentInstance.patient = MINIMAL;
      await open();
      for (const id of ['edit-email', 'edit-phone', 'edit-dob', 'edit-city', 'edit-state', 'edit-zip']) {
        expect(input(id).value).withContext(id).toBe('');
      }
      expect((el.querySelector('#edit-gender') as HTMLSelectElement).value).toBe('');
      expect(Array.from(el.querySelectorAll<HTMLOptionElement>('#edit-gender option')).map(o => o.value)).toEqual(['', 'female', 'male', 'x', 'undisclosed']);
    });

    it('saves with only the two names: blanks go as null, no address object, and nothing is flagged as required', async () => {
      fixture.componentInstance.patient = MINIMAL;
      await open();
      submit();
      expect(el.querySelector('.field-error')).toBeNull();
      const put = http.expectOne(`${api}/patients/5`);
      expect(put.request.body).toEqual({ id: 5, firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, dateOfBirth: null, address: null });
      put.flush(put.request.body);
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs());
      expect(saved[0].contactChanged).toBeFalse(); // null before, empty after: not a contact change
    });

    it('still requires the names and still checks an e-mail that was typed', async () => {
      fixture.componentInstance.patient = MINIMAL;
      await open();
      type('edit-lastName', '');
      type('edit-email', 'nope');
      submit();
      http.expectNone(`${api}/patients/5`);
      expect(el.textContent).toContain('This field is required.');
      expect(el.textContent).toContain('Enter a valid email address.');
      expect(el.querySelectorAll('.field-error').length).toBe(2);
    });

    it('keeps a partial address: only the typed parts are sent', async () => {
      fixture.componentInstance.patient = MINIMAL;
      await open();
      type('edit-city', 'Laval');
      submit();
      const put = http.expectOne(`${api}/patients/5`);
      expect(put.request.body.address).toEqual({ city: 'Laval', state: null, zip: null });
      put.flush(put.request.body);
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs());
    });

    it('typing a phone is a contact change', async () => {
      fixture.componentInstance.patient = MINIMAL;
      await open('GRANTED');
      expect(el.querySelector('.consent-notice')).toBeNull();
      type('edit-phone', '514-555-0142');
      expect(el.querySelector('.consent-notice')).not.toBeNull();
    });
  });

  it('shows the server field errors under their fields, including the address ones', async () => {
    await open();
    type('edit-dob', '1990-01-01');
    submit();
    http.expectOne(`${api}/patients/5`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: 'Validation failed', fieldErrors: { dateOfBirth: 'must be in the past', 'address.city': 'must not be blank' } },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('#edit-dob-err')).not.toBeNull();
    expect(el.querySelector('#edit-city-err')).not.toBeNull();
    expect(saved.length).toBe(0);
    expect(closed).toBe(0);
    // editing a field drops its server message
    type('edit-city', 'Laval');
    expect(el.querySelector('#edit-city-err')).toBeNull();
    expect(el.querySelector('#edit-dob-err')).not.toBeNull();
  });

  it('shows a banner when the save fails without field errors', async () => {
    await open();
    submit();
    http.expectOne(`${api}/patients/5`).flush({ status: 500, error: 'INTERNAL', message: 'x', fieldErrors: {} }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.querySelector('.banner--error')).not.toBeNull();
    expect(closed).toBe(0);
  });

  describe('consent notice', () => {
    const notice = () => el.querySelector('.consent-notice');

    it('appears only when the email changes and consent is GRANTED', async () => {
      await open('GRANTED');
      expect(notice()).toBeNull();
      type('edit-email', 'jane.new@example.com');
      expect(notice()!.textContent).toContain('Changing the email or phone resets reminder consent');
      type('edit-email', 'jane@example.com');
      expect(notice()).toBeNull();
    });

    it('appears when the phone changes', async () => {
      await open('GRANTED');
      type('edit-phone', '555-0199');
      expect(notice()).not.toBeNull();
    });

    it('stays out when only other fields change', async () => {
      await open('GRANTED');
      type('edit-city', 'Laval');
      type('edit-firstName', 'Janet');
      expect(notice()).toBeNull();
    });

    it('stays out when consent is not GRANTED', async () => {
      await open('UNKNOWN');
      type('edit-email', 'jane.new@example.com');
      expect(notice()).toBeNull();
    });

    it('reports the contact change and the refreshed consent after saving', async () => {
      await open('GRANTED');
      type('edit-email', 'jane.new@example.com');
      submit();
      const put = http.expectOne(`${api}/patients/5`);
      put.flush(put.request.body);
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'UNKNOWN' }));
      expect(saved[0].contactChanged).toBeTrue();
      expect(saved[0].prefs!.contactConsent).toBe('UNKNOWN');
    });
  });

  it('closes on Escape and returns the focus to the trigger', async () => {
    await open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(1);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes from the Cancel button and the backdrop', async () => {
    await open();
    (el.querySelector('.drawer__footer .btn--secondary') as HTMLButtonElement).click();
    (el.querySelector('.drawer-backdrop') as HTMLElement).click();
    expect(closed).toBe(2);
  });

  it('removes the scroll lock when destroyed', async () => {
    await open();
    fixture.destroy();
    expect(document.body.classList.contains('drawer-open')).toBeFalse();
  });
});

describe('PatientEditComponent when the clinic collects neither gender nor address (PRIV-A-17)', () => {
  it('shows no gender or address field and never sends a value for them', async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule],
      declarations: [PatientEditComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('RECEPTION'), provideCollection(false, false)]
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PatientEditComponent);
    fixture.componentInstance.patient = { id: 5, firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, address: null, dateOfBirth: null };
    const el: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'UNKNOWN' }));
    fixture.detectChanges();
    expect(el.querySelector('#edit-gender')).toBeNull();
    expect(el.querySelector('#edit-city')).toBeNull();
    expect(el.querySelector('label[for=edit-email]')!.textContent).toContain('optional');
    fixture.componentInstance.form.gender = 'female';
    fixture.componentInstance.form.city = 'Laval';
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const put = http.expectOne(`${environment.apiUrl}/patients/5`);
    expect(put.request.body).toEqual({ id: 5, firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, dateOfBirth: null, address: null });
    put.flush({ id: 5, firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, address: null });
    http.expectOne(`${environment.apiUrl}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'UNKNOWN' }));
    http.verify();
    fixture.destroy();
  });
});

describe('PatientEditComponent when the clinic settings cannot be read (review fix)', () => {
  it('hides gender and address but sends back the stored values, so a save never erases them', async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule],
      declarations: [PatientEditComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('RECEPTION'), { provide: SettingsService, useValue: { clinic$: throwError(() => new Error('down')) } }]
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PatientEditComponent);
    const address = { city: 'Zzz-Ville', state: 'QC', zip: 'H0H 0H0' };
    fixture.componentInstance.patient = { id: 5, firstName: 'Zzz-Test', lastName: 'Garde', email: null, phone: null, gender: 'x', address, dateOfBirth: null };
    const el: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'UNKNOWN' }));
    fixture.detectChanges();
    expect(el.querySelector('#edit-gender')).toBeNull();
    expect(el.querySelector('#edit-city')).toBeNull();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const put = http.expectOne(`${environment.apiUrl}/patients/5`);
    expect(put.request.body.gender).toBe('x');
    expect(put.request.body.address).toEqual(address);
    put.flush({ id: 5, firstName: 'Zzz-Test', lastName: 'Garde', email: null, phone: null, gender: 'x', address });
    http.expectOne(`${environment.apiUrl}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'UNKNOWN' }));
    http.verify();
    fixture.destroy();
  });
});
