import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { addDays, businessToday } from '../../../shared/link.util';
import { deskPatient, patientMatch, provideCollection, providePermissions } from '../../../testing/fixtures';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';
import { AddPatientDrawerComponent } from './add-patient-drawer.component';

describe('AddPatientDrawerComponent', () => {
  let fixture: ComponentFixture<AddPatientDrawerComponent>;
  let component: AddPatientDrawerComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  let created: { consentSaved: boolean }[];
  let closed: number;
  let used: number[];
  const base = `${environment.apiUrl}/patients`;

  beforeEach(async () => {
    created = [];
    closed = 0;
    used = [];
    await TestBed.configureTestingModule({
      providers: [providePermissions('RECEPTION'), provideCollection(true, true)],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, AddPatientDrawerComponent]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddPatientDrawerComponent);
    component = fixture.componentInstance;
    component.created.subscribe(r => created.push(r));
    component.closed.subscribe(() => closed++);
    component.useExisting.subscribe(id => used.push(id));
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  const fill = async (id: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel registers controls that appear (the radios) in a microtask
  };
  const submit = () => (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  const submitBtn = () => el.querySelector<HTMLButtonElement>('button[type=submit]')!;

  it('is a dialog with the date of birth capped at yesterday', () => {
    expect(el.querySelector('.drawer')!.getAttribute('role')).toBe('dialog');
    expect(el.querySelector<HTMLInputElement>('#new-dob')!.max).toBe(addDays(businessToday(), -1));
  });

  it('focuses the first name on open', async () => {
    const f = TestBed.createComponent(AddPatientDrawerComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await new Promise(r => setTimeout(r));
    expect(document.activeElement!.id).toBe('new-firstName');
    f.nativeElement.remove();
    f.destroy();
  });

  it('asks the page to close on Escape, from the Cancel button and from the backdrop', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(1);
    Array.from(el.querySelectorAll<HTMLButtonElement>('.drawer__footer button')).find(b => b.textContent!.includes('Cancel'))!.click();
    expect(closed).toBe(2);
    (el.querySelector('.drawer-backdrop') as HTMLElement).click();
    expect(closed).toBe(3);
    (el.querySelector('.drawer__header button') as HTMLButtonElement).click();
    expect(closed).toBe(4);
  });

  it('Tab cycles inside the drawer: from the last control to the first, Shift+Tab from the first to the last', async () => {
    document.body.appendChild(el);
    const drawer = el.querySelector('.drawer') as HTMLElement;
    const focusables = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first.getAttribute('aria-label')).toBe('Close');
    expect(last.textContent).toContain('Cancel'); // the submit button is disabled until the form is valid
    const press = (shiftKey: boolean) => {
      const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true, bubbles: true });
      document.dispatchEvent(ev);
      return ev;
    };
    last.focus();
    expect(press(false).defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(first);
    expect(press(true).defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(last);
    focusables[2].focus(); // in the middle the browser's own Tab order is left alone
    expect(press(false).defaultPrevented).toBeFalse();
    el.remove();
  });

  it('needs only a first and a last name: no phone, e-mail, gender or address is required', async () => {
    expect(submitBtn().disabled).toBeTrue();
    await fill('new-firstName', 'Zzz-Test');
    expect(submitBtn().disabled).toBeTrue();
    await fill('new-lastName', 'Seul');
    expect(submitBtn().disabled).toBeFalse();
    expect(Array.from(el.querySelectorAll('.drawer [required]')).map(e => e.id)).toEqual(['new-firstName', 'new-lastName']);
    expect(Array.from(el.querySelectorAll<HTMLOptionElement>('#new-gender option')).map(o => o.value)).toEqual(['', 'female', 'male', 'x', 'undisclosed']);
    submit();
    expect(component.saving).toBeTrue();
    const post = http.expectOne(`${base}/register`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, dateOfBirth: null, address: null });
    expect('id' in post.request.body).toBeFalse();
    expect(post.request.params.keys().length).toBe(0);
    post.flush({ ...post.request.body, id: 9 });
    expect(http.match(r => r.url.includes('contact-consent')).length).toBe(0); // nothing was answered, nothing is sent
    expect(component.saving).toBeFalse();
    expect(created).toEqual([{ consentSaved: true }]);
  });

  it('sends the typed values, trimmed, with the date of birth and a partial address', async () => {
    await fill('new-firstName', ' Ann ');
    await fill('new-lastName', 'Lee');
    await fill('new-email', 'ann@example.com');
    await fill('new-dob', '1990-01-15');
    await fill('new-city', 'Laval');
    component.patient.gender = 'female';
    component.addPatient();
    expect(http.expectOne(`${base}/register`).request.body).toEqual({
      firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com', phone: null, gender: 'female', dateOfBirth: '1990-01-15',
      address: { city: 'Laval', state: null, zip: null }
    });
  });

  it('shows each server field message under its own input on VALIDATION_FAILED', async () => {
    spyOn(console, 'error');
    await fill('new-firstName', 'Ann');
    await fill('new-lastName', 'Lee');
    component.addPatient();
    http.expectOne(`${base}/register`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: 'x', fieldErrors: { phone: 'must be a valid phone number', 'address.zip': 'must be a valid postal code' } },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    const under = (id: string) => el.querySelector(`#${id}`)!.parentElement!.querySelector('.field-error')?.textContent?.trim();
    expect(under('new-phone')).toBe('Invalid phone number.');
    expect(under('new-zip')).toBe('Invalid postal code.');
    expect(under('new-email')).toBeUndefined();
    expect(created).toEqual([]);
  });

  describe('messages question', () => {
    it('is asked only once a phone or an e-mail is typed, with nothing selected', async () => {
      expect(el.querySelector('.consent-group')).toBeNull();
      await fill('new-phone', '514-555-0142');
      const group = el.querySelector('.consent-group')!;
      expect(group.textContent).toContain('Accepts messages from the clinic:');
      const radios = Array.from(group.querySelectorAll<HTMLInputElement>('input[type=radio]'));
      expect(radios.map(r => r.value)).toEqual(['GRANTED', 'WITHDRAWN']);
      expect(radios.some(r => r.checked)).toBeFalse();
      await fill('new-phone', '');
      expect(el.querySelector('.consent-group')).toBeNull();
    });

    it('sends « Yes » with PUT contact-consent after the create, never before it', async () => {
      await fill('new-firstName', 'Zzz-Test');
      await fill('new-lastName', 'Parent');
      await fill('new-phone', '514-555-0142');
      el.querySelector<HTMLInputElement>('#new-consent-yes')!.click();
      fixture.detectChanges();
      submit();
      expect(http.match(r => r.url.includes('contact-consent')).length).toBe(0);
      const post = http.expectOne(`${base}/register`);
      expect(post.request.body.phone).toBe('514-555-0142');
      post.flush({ ...post.request.body, id: 9 });
      const put = http.expectOne(`${base}/9/contact-consent`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ contactConsent: 'GRANTED' });
      expect(created).toEqual([]); // only once the answer is saved
      put.flush({ contactConsent: 'GRANTED' });
      expect(created).toEqual([{ consentSaved: true }]);
    });

    it('sends « No » as WITHDRAWN', async () => {
      await fill('new-firstName', 'Zzz-Test');
      await fill('new-lastName', 'Parent');
      await fill('new-email', 'zzz@example.com');
      el.querySelector<HTMLInputElement>('#new-consent-no')!.click();
      fixture.detectChanges();
      submit();
      http.expectOne(`${base}/register`).flush({ id: 9 });
      const put = http.expectOne(`${base}/9/contact-consent`);
      expect(put.request.body).toEqual({ contactConsent: 'WITHDRAWN' });
      put.flush({ contactConsent: 'WITHDRAWN' });
    });

    it('sends nothing when no answer was chosen, or when the contact was typed and then removed', async () => {
      await fill('new-firstName', 'Zzz-Test');
      await fill('new-lastName', 'Parent');
      await fill('new-phone', '514-555-0142');
      el.querySelector<HTMLInputElement>('#new-consent-yes')!.click();
      await fill('new-phone', '');
      submit();
      http.expectOne(`${base}/register`).flush({ id: 9 });
      expect(http.match(r => r.url.includes('contact-consent')).length).toBe(0);
      expect(created).toEqual([{ consentSaved: true }]);
    });

    it('keeps the patient and reports it when only the answer could not be saved', async () => {
      await fill('new-firstName', 'Zzz-Test');
      await fill('new-lastName', 'Parent');
      await fill('new-phone', '514-555-0142');
      el.querySelector<HTMLInputElement>('#new-consent-yes')!.click();
      fixture.detectChanges();
      submit();
      http.expectOne(`${base}/register`).flush({ id: 9 });
      http.expectOne(`${base}/9/contact-consent`).flush({ status: 500, error: 'X', message: 'x', fieldErrors: {} }, { status: 500, statusText: 'Server Error' });
      expect(created).toEqual([{ consentSaved: false }]);
    });
  });

  describe('POSSIBLE_DUPLICATE', () => {
    const dupBody = (candidates: unknown[]) => ({ status: 409, error: 'POSSIBLE_DUPLICATE', message: 'x', fieldErrors: {}, details: { candidates } });
    const open409 = async () => {
      await fill('new-firstName', 'Zzz-Test');
      await fill('new-lastName', 'Arrivee');
      submit();
      http.expectOne(`${base}/register`).flush(
        dupBody([patientMatch({ patient: deskPatient({ id: 31, firstName: 'Zzz-Test', lastName: 'Arrivee', dateOfBirth: '1990-01-15' }) })]),
        { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      await new Promise(r => setTimeout(r));
    };

    it('lists the candidates with « Use this file » focused, and creates nothing', async () => {
      document.body.appendChild(el);
      await open409();
      const box = el.querySelector('.dup-candidates')!;
      expect(box.textContent).toContain('A similar patient already exists');
      expect(box.textContent).toContain('Zzz-Test Arrivee');
      expect(box.textContent).toContain('1990');
      expect(document.activeElement).toBe(el.querySelector('#dup-use-0'));
      expect(el.querySelector('.drawer .error-message')).toBeNull(); // not shown as a failure
      expect(component.saving).toBeFalse();
      expect(created).toEqual([]);
      el.remove();
    });

    it('« Use this file » hands the existing patient to the page and sends no second create', async () => {
      await open409();
      el.querySelector<HTMLButtonElement>('#dup-use-0')!.click();
      expect(used).toEqual([31]);
      expect(http.match(r => r.url === `${base}/register`).length).toBe(0);
    });

    it('« Create anyway » sends the same data again with ?confirmNew=true', async () => {
      await open409();
      el.querySelector<HTMLButtonElement>('#dup-create-anyway')!.click();
      const again = http.expectOne(r => r.url === `${base}/register`);
      expect(again.request.params.get('confirmNew')).toBe('true');
      expect(again.request.body.firstName).toBe('Zzz-Test');
      again.flush({ id: 40 });
      expect(created).toEqual([{ consentSaved: true }]);
    });

    it('shows a 409 without candidates as an ordinary error', async () => {
      spyOn(console, 'error');
      await fill('new-firstName', 'Zzz-Test');
      await fill('new-lastName', 'Arrivee');
      submit();
      http.expectOne(`${base}/register`).flush(dupBody([]), { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el.querySelector('.dup-candidates')).toBeNull();
      expect(el.querySelector('.drawer .error-message')).not.toBeNull();
    });
  });
});

describe('AddPatientDrawerComponent when the clinic collects neither gender nor address (PRIV-A-17)', () => {
  let fixture: ComponentFixture<AddPatientDrawerComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [providePermissions('RECEPTION'), provideCollection(false, false)],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, AddPatientDrawerComponent]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddPatientDrawerComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  it('shows no gender or address field, marks e-mail and phone optional, and sends only the two names', async () => {
    expect(el.querySelector('#new-gender')).toBeNull();
    expect(el.querySelector('#new-city')).toBeNull();
    expect(el.querySelector('#new-state')).toBeNull();
    expect(el.querySelector('#new-zip')).toBeNull();
    expect(el.querySelector('label[for=new-email]')!.textContent).toContain('optional');
    expect(el.querySelector('label[for=new-phone]')!.textContent).toContain('optional');
    const first = el.querySelector<HTMLInputElement>('#new-firstName')!;
    first.value = 'Zzz-Test';
    first.dispatchEvent(new Event('input', { bubbles: true }));
    const last = el.querySelector<HTMLInputElement>('#new-lastName')!;
    last.value = 'Seul';
    last.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    // even a value left in the model (e.g. typed before the settings arrived) is never sent
    fixture.componentInstance.patient.gender = 'female';
    fixture.componentInstance.patient.address = { city: 'Laval', state: null, zip: null };
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const post = http.expectOne(`${environment.apiUrl}/patients/register`);
    expect(post.request.body).toEqual({ firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, dateOfBirth: null, address: null });
    post.flush({ id: 9, firstName: 'Zzz-Test', lastName: 'Seul', email: null, phone: null, gender: null, address: null });
  });
});

describe('AddPatientDrawerComponent when the clinic collects only the address', () => {
  it('shows the three address fields but no gender', async () => {
    await TestBed.configureTestingModule({
      providers: [providePermissions('RECEPTION'), provideCollection(false, true)],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, AddPatientDrawerComponent]
    }).compileComponents();
    const f = TestBed.createComponent(AddPatientDrawerComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('#new-gender')).toBeNull();
    expect(el.querySelector('#new-city')).not.toBeNull();
    expect((el.querySelector('#new-city') as HTMLInputElement).required).toBeFalse();
    f.destroy();
  });
});
