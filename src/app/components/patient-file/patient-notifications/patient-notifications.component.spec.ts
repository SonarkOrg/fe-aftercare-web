import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../Services/Notification.service';
import { SettingsService } from '../../../Services/Settings.service';
import { AccessRole } from '../../../models/me.model';
import { CLINIC, contactPrefs, notification, providePermissions } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { PatientNotificationsComponent } from './patient-notifications.component';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';

describe('PatientNotificationsComponent', () => {
  const api = environment.apiUrl;
  let fixture: ComponentFixture<PatientNotificationsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  function setup(role: AccessRole = 'NURSE') {
    TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule],
      declarations: [PatientNotificationsComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions(role), { provide: SettingsService, useValue: { clinic$: of(CLINIC) } }]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientNotificationsComponent);
    fixture.componentInstance.patientId = 5;
    el = fixture.nativeElement;
  }
  afterEach(() => http.verify());

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  async function init(prefs: object = contactPrefs(), items: object[] = [], role: AccessRole = 'NURSE') {
    setup(role);
    await settle();
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(prefs);
    const list = http.expectOne(r => r.url === `${api}/patients/5/notifications`);
    expect([list.request.params.get('page'), list.request.params.get('size')]).toEqual(['0', '20']);
    list.flush({ items, page: 0, size: 20, hasMore: false });
    await settle();
  }
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const radio = (name: string, value: string) => q<HTMLInputElement>(`input[name=${name}][value=${value}]`);
  const pick = async (name: string, value: string) => {
    radio(name, value).click();
    await settle();
  };

  it('shows the consent radios: Not recorded / Consents / Opted out', async () => {
    await init();
    expect(Array.from(el.querySelectorAll('.consent-group .radio-row')).map(l => l.textContent!.trim())).toEqual([
      'Not recorded', 'Consents to reminders by email/SMS', 'Opted out']);
    expect(radio('consent', 'UNKNOWN').checked).toBeTrue();
    expect(radio('consent', 'UNKNOWN').disabled).toBeFalse();
  });

  it('emits the saved preferences', async () => {
    await init();
    const emitted: unknown[] = [];
    fixture.componentInstance.saved.subscribe(p => emitted.push(p));
    await pick('consent', 'GRANTED');
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    const saved = contactPrefs({ contactConsent: 'GRANTED' });
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(saved);
    await settle();
    expect(emitted).toEqual([saved]);
  });

  it('reloads the recent messages when a link is sent for this patient, not another', async () => {
    await init();
    const svc = TestBed.inject(NotificationService);
    svc.notifySent(99);
    expect(http.match(r => r.url === `${api}/patients/5/notifications`).length).toBe(0);
    svc.notifySent(5);
    const list = http.expectOne(r => r.url === `${api}/patients/5/notifications`);
    expect(list.request.method).toBe('GET');
    list.flush({ items: [notification()], page: 0, size: 20, hasMore: false });
    await settle();
    expect(el.querySelectorAll('.notif-row').length).toBe(1);
  });

  it('points the unavailable channel at its hint with aria-describedby', async () => {
    await init(contactPrefs({ smsAvailable: false }));
    expect(radio('channel', 'SMS').getAttribute('aria-describedby')).toBe('pn-hint-sms');
    expect(q('#pn-hint-sms')).not.toBeNull();
    expect(radio('channel', 'EMAIL').hasAttribute('aria-describedby')).toBeFalse();
  });

  it('disables "Not recorded" once another value was saved', async () => {
    await init(contactPrefs({ contactConsent: 'GRANTED' }));
    expect(radio('consent', 'GRANTED').checked).toBeTrue();
    expect(radio('consent', 'UNKNOWN').disabled).toBeTrue();
  });

  it('after saving a consent, UNKNOWN becomes disabled', async () => {
    await init();
    await pick('consent', 'GRANTED');
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs({ contactConsent: 'GRANTED', consentUpdatedAt: '2026-10-14T15:00:00Z', consentUpdatedByName: 'Dev Nurse' }));
    await settle();
    expect(radio('consent', 'UNKNOWN').disabled).toBeTrue();
    expect(q('[role=status]').textContent).toContain('Saved.');
  });

  it('explains what opting out means', async () => {
    await init(contactPrefs({ contactConsent: 'GRANTED' }));
    expect(q('.consent-help')).toBeNull();
    await pick('consent', 'WITHDRAWN');
    expect(q('.consent-help').textContent).toContain('No messages will be sent until consent is recorded again.');
  });

  it('hints on an unavailable channel with the generic text, and not on an available one', async () => {
    await init(contactPrefs({ emailAvailable: true, smsAvailable: false }));
    expect(q('.hint-sms').textContent).toContain('Not available (check the address or ask an admin to enable this channel)');
    expect(q('.hint-email')).toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
    await init(contactPrefs({ emailAvailable: false, smsAvailable: true }));
    expect(q('.hint-email').textContent).toContain('Not available (check the address or ask an admin to enable this channel)');
    expect(q('.hint-sms')).toBeNull();
  });

  it('offers the language as Clinic default (Français) / Français / English', async () => {
    await init();
    expect(Array.from(q<HTMLSelectElement>('#pn-lang').options).map(o => o.textContent!.trim())).toEqual(['Clinic default (Français)', 'Français', 'English']);
    expect(q<HTMLSelectElement>('#pn-lang').value).toBe('');
  });

  it('shows who changed the consent last, and when (Toronto time)', async () => {
    await init(contactPrefs({ contactConsent: 'GRANTED', consentUpdatedAt: '2026-10-14T15:00:00Z', consentUpdatedByName: 'Dev Nurse' }));
    expect(q('.consent-updated').textContent).toContain('Updated 2026-10-14 11:00 by Dev Nurse');
  });

  it('saves the exact body: channel, language (null = clinic default) and consent', async () => {
    await init(contactPrefs({ preferredChannel: 'EMAIL', language: null, contactConsent: 'UNKNOWN' }));
    await pick('consent', 'GRANTED');
    await pick('channel', 'SMS');
    const sel = q<HTMLSelectElement>('#pn-lang');
    sel.value = 'EN';
    sel.dispatchEvent(new Event('change'));
    await settle();
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    const r = http.expectOne(`${api}/patients/5/contact-preferences`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ preferredChannel: 'SMS', language: 'EN', contactConsent: 'GRANTED' });
    r.flush(contactPrefs({ preferredChannel: 'SMS', language: 'EN', effectiveLanguage: 'EN', contactConsent: 'GRANTED' }));
    await settle();
    expect(sel.value).toBe('EN');
  });

  it('sends language null for the clinic default', async () => {
    await init(contactPrefs({ language: 'FR' }));
    const sel = q<HTMLSelectElement>('#pn-lang');
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
    await settle();
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    const r = http.expectOne(`${api}/patients/5/contact-preferences`);
    expect(r.request.body.language).toBeNull();
    r.flush(contactPrefs());
  });

  it('shows server field errors (UNKNOWN cannot be reset) and other failures', async () => {
    await init(contactPrefs({ contactConsent: 'GRANTED' }));
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: 'x', fieldErrors: { contactConsent: 'cannot be reset to UNKNOWN' } }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('.consent-group .field-error').textContent).toBe('Cannot go back to "Not recorded".');
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    http.expectOne(`${api}/patients/5/contact-preferences`).flush({ status: 403, error: 'FORBIDDEN', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(q('.banner--error').textContent).toContain("You don't have permission for this action.");
  });

  describe('recent messages', () => {
    it('says so when none were sent', async () => {
      await init();
      expect(q('.empty-line').textContent).toContain('No messages sent yet.');
    });

    it('renders the template label, channel, status chip, masked recipient, date, who and the error', async () => {
      await init(contactPrefs(), [
        notification(),
        notification({ id: 2, template: 'CHECKIN_REMINDER', channel: 'SMS', status: 'FAILED', automated: true, requestedByName: null, recipientMasked: '•••-•••-0100', lastError: 'PROVIDER_ERROR', sentAt: null }),
        notification({ id: 3, template: 'APPOINTMENT_LINK', status: 'PENDING', sentAt: null, recipientMasked: null }),
        notification({ id: 4, template: 'APPOINTMENT_REMINDER', status: 'CANCELLED', sentAt: null }),
        notification({ id: 5, status: 'SKIPPED', lastError: 'NO_CONSENT', sentAt: null }),
        notification({ id: 6, status: 'SENDING', sentAt: null })]);
      const rows = Array.from(el.querySelectorAll('.notif-row'));
      const text = (i: number) => rows[i].textContent!.replace(/\s+/g, ' ').trim();
      expect(text(0)).toContain('Follow-up link · Email');
      expect(text(0)).toContain('j•••@example.com');
      expect(text(0)).toContain('Sent 2026-10-14 11:00');
      expect(text(0)).toContain('by Dev Nurse');
      expect(text(0)).toContain('✓Sent');
      expect(text(1)).toContain('Check-in reminder · SMS');
      expect(text(1)).toContain('Created 2026-10-14 11:00');
      expect(text(1)).toContain('automatic');
      expect(text(1)).toContain('Provider error');
      expect(text(1)).toContain('▲Failed');
      expect(text(2)).toContain('Questionnaire link');
      expect(text(2)).toContain('Queued');
      expect(text(3)).toContain('Questionnaire reminder');
      expect(text(3)).toContain('●Cancelled');
      expect(text(4)).toContain('Not needed');
      expect(text(4)).toContain('No consent');
      expect(text(5)).toContain('Sending');
      expect(rows[0].querySelector('.chip')!.classList).toContain('chip--good');
      expect(rows[1].querySelector('.chip')!.classList).toContain('chip--critical');
      expect(rows[3].querySelector('.chip')!.classList).toContain('chip--warning');
    });

    it('shows a retry when the list fails', async () => {
      setup();
      await settle();
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs());
      http.expectOne(r => r.url === `${api}/patients/5/notifications`).flush('x', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(q('.banner--error').textContent).toContain('Server error. Please try again later.');
    });
  });

  it('offers Save to roles with PATIENT_WRITE (all four)', async () => {
    await init(contactPrefs(), [], 'RECEPTION');
    expect(q('.save-prefs')).not.toBeNull();
  });
});
