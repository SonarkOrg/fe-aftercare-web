import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { notificationSettings } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { NotificationSettingsComponent } from './notification-settings.component';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';

describe('NotificationSettingsComponent', () => {
  const url = `${environment.apiUrl}/settings/notifications`;
  let fixture: ComponentFixture<NotificationSettingsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule],
      declarations: [NotificationSettingsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationSettingsComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  async function init(body: object = notificationSettings()) {
    await settle();
    http.expectOne(url).flush(body);
    await settle();
  }
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const type = async (sel: string, value: string) => {
    const input = q<HTMLInputElement>(sel);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const toggle = async (sel: string) => {
    q<HTMLInputElement>(sel).click();
    await settle();
  };
  const save = async () => {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await settle();
  };

  it('loads GET /settings/notifications and fills the form', async () => {
    await init(notificationSettings({ smsEnabled: true, checkInReminderTime: '17:30', appointmentReminderHours: 36, missedCheckInCutoff: '19:45' }));
    expect(q<HTMLInputElement>('#ns-email').checked).toBeTrue();
    expect(q<HTMLInputElement>('#ns-sms').checked).toBeTrue();
    expect(q<HTMLInputElement>('#ns-ci-on').checked).toBeTrue();
    expect(q<HTMLInputElement>('#ns-ci-time').value).toBe('17:30');
    expect(q<HTMLInputElement>('#ns-ci-time').type).toBe('time');
    expect(q<HTMLInputElement>('#ns-ci-time').step).toBe('60');
    expect(q<HTMLInputElement>('#ns-ap-hours').value).toBe('36');
    expect(q<HTMLInputElement>('#ns-mc-time').value).toBe('19:45');
  });

  it('has the three cards with their texts', async () => {
    await init();
    expect(Array.from(el.querySelectorAll('.card__title--sm')).map(h => h.textContent)).toEqual(['Delivery channels', 'Patient reminders', 'Missed check-ins']);
    expect(el.textContent).toContain('Patients receive messages only if their consent is recorded as granted.');
    expect(el.textContent).toContain('Reminders are sent only when the check-in or questionnaire is still missing, and never between 21:00 and 08:00.');
    expect(el.textContent).toContain('A second missed day in a row raises a high alert.');
    expect(q('label[for=ns-ci-on]').textContent).toBe('Check-in reminder');
    expect(q('label[for=ns-ap-on]').textContent).toBe('Pre-appointment questionnaire reminder');
    expect(q('label[for=ns-mc-on]').textContent).toBe('Create an alert when a daily check-in is missing');
  });

  it('shows a warning chip for the LOG provider and a neutral one for SMTP / Twilio', async () => {
    await init(notificationSettings({ emailProvider: 'LOG', smsProvider: 'LOG' }));
    for (const sel of ['.chip-email', '.chip-sms']) {
      const chip = q(sel + ' .chip');
      expect(chip.classList).toContain('chip--warning');
      expect(chip.textContent).toContain('Logging only: messages are not delivered');
      expect(chip.querySelector('.chip__glyph')!.textContent).toBe('●');
    }
    fixture.destroy();
    fixture = TestBed.createComponent(NotificationSettingsComponent);
    el = fixture.nativeElement;
    await init(notificationSettings({ emailProvider: 'SMTP', smsProvider: 'TWILIO' }));
    expect(q('.chip-email .chip').classList).toContain('chip--neutral');
    expect(q('.chip-email .chip').textContent).toContain('Delivered via SMTP');
    expect(q('.chip-sms .chip').textContent).toContain('Delivered via Twilio');
  });

  it('sends exactly the editable fields (no provider, updatedAt or updatedBy)', async () => {
    await init();
    await toggle('#ns-sms');
    await toggle('#ns-ap-on');
    await type('#ns-ci-time', '17:30');
    await type('#ns-ap-hours', '36');
    await toggle('#ns-mc-on');
    await type('#ns-mc-time', '19:00');
    await save();
    const r = http.expectOne(url);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({
      emailEnabled: true, smsEnabled: true, checkInReminderEnabled: true, checkInReminderTime: '17:30',
      appointmentReminderEnabled: false, appointmentReminderHours: 36, missedCheckInEnabled: false, missedCheckInCutoff: '19:00'
    });
    r.flush(notificationSettings({ ...r.request.body, updatedAt: '2026-10-14T15:00:00Z', updatedByName: 'Dev Admin' }));
    await settle();
    expect(q('[role=status]').textContent).toContain('Saved.');
  });

  it('refuses a reminder at or after the missed check-in cutoff, without a request', async () => {
    await init();
    await type('#ns-ci-time', '20:00');
    await save();
    http.expectNone(url);
    expect(q('#ns-ci-time + .field-error').textContent).toBe('Must be before the missed check-in cutoff.');
    await type('#ns-ci-time', '21:30');
    await save();
    http.expectNone(url);
    expect(q('#ns-ci-time + .field-error').textContent).toContain('before the missed check-in cutoff');
  });

  it('refuses hours outside 24–72 and non-whole numbers', async () => {
    await init();
    for (const bad of ['23', '73', '30.5']) {
      await type('#ns-ap-hours', bad);
      await save();
      http.expectNone(url);
      expect(q('#ns-ap-hours + .field-error').textContent).withContext(bad).toContain('24 to 72');
    }
    await type('#ns-ap-hours', '24');
    await save();
    http.expectOne(url).flush(notificationSettings({ appointmentReminderHours: 24 }));
    await settle();
  });

  it('refuses a missing time', async () => {
    await init();
    await type('#ns-mc-time', '');
    await save();
    http.expectNone(url);
    expect(q('#ns-mc-time + .field-error').textContent).toBe('Enter a time as HH:mm.');
  });

  it('maps server fieldErrors next to their fields', async () => {
    await init();
    await save();
    http.expectOne(url).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: 'x', fieldErrors: { checkInReminderTime: 'must be before the missed check-in cutoff', appointmentReminderHours: 'must be between 24 and 72' } },
      { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('#ns-ci-time + .field-error').textContent).toBe('Must be before the missed check-in cutoff.');
    expect(q('#ns-ap-hours + .field-error').textContent).toBe('Between 24 and 72.');
    expect(q<HTMLButtonElement>('.save-notifications').disabled).toBeFalse();
  });

  it('shows a banner for other failures, including FORBIDDEN', async () => {
    await init();
    await save();
    http.expectOne(url).flush({ status: 403, error: 'FORBIDDEN', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(q('.banner--error').textContent).toContain("You don't have permission for this action.");
  });

  it('shows a load error with a retry', async () => {
    await settle();
    http.expectOne(url).flush('x', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(q('.banner--error').textContent).toContain('Server error. Please try again later.');
    q<HTMLButtonElement>('.banner--error button').click();
    http.expectOne(url).flush(notificationSettings());
    await settle();
    expect(q('form')).not.toBeNull();
  });
});
