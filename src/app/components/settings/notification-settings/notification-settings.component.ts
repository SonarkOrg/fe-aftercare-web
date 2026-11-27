import { Component, OnInit } from '@angular/core';
import { SettingsService } from '../../../Services/Settings.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { I18nService } from '../../../i18n/i18n.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { MESSAGE_WORDINGS, MessageWording, NotificationSettings, NotificationSettingsRequest } from '../../../models/notification.model';
import { ChipSpec } from '../../../shared/status';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function providerChip(provider: string): ChipSpec {
  if (provider === 'OFF') {
    return { tone: 'neutral', glyph: '—', label: { key: 'settings.notif.providerOff' } };
  }
  if (provider === 'LOG') {
    return { tone: 'warning', glyph: '●', label: { key: 'settings.notif.logOnly' } };
  }
  return { tone: 'neutral', glyph: '—', label: { key: 'settings.notif.deliveredVia', params: { provider: provider === 'TWILIO' ? 'Twilio' : provider } } };
}

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html'
})
export class NotificationSettingsComponent implements OnInit {
  current: NotificationSettings | null = null;
  form: NotificationSettingsRequest = {
    emailEnabled: false, smsEnabled: false, checkInReminderEnabled: false, checkInReminderTime: '18:00',
    appointmentReminderEnabled: false, appointmentReminderHours: 48, missedCheckInEnabled: true, missedCheckInCutoff: '20:00', messageWording: 'NEUTRAL'
  };
  readonly wordings = MESSAGE_WORDINGS;
  loadError: string | null = null;
  saving = false;
  saved = false;
  banner: string | null = null;
  errors: Record<string, string> = {};

  constructor(private settings: SettingsService, private i18n: I18nService, private apiErrors: ApiErrorsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadError = null;
    this.settings.notifications().subscribe({
      next: s => this.apply(s),
      error: err => (this.loadError = this.apiErrors.text(err, 'settings.notif.error.load'))
    });
  }

  private apply(s: NotificationSettings): void {
    this.current = s;
    // A channel with no provider cannot be on (the API refuses it with CHANNEL_NOT_CONFIGURED), whatever the stored flag says.
    this.form = {
      emailEnabled: s.emailProvider === 'OFF' ? false : s.emailEnabled, smsEnabled: s.smsProvider === 'OFF' ? false : s.smsEnabled,
      checkInReminderEnabled: s.checkInReminderEnabled, checkInReminderTime: s.checkInReminderTime,
      appointmentReminderEnabled: s.appointmentReminderEnabled, appointmentReminderHours: s.appointmentReminderHours,
      missedCheckInEnabled: s.missedCheckInEnabled, missedCheckInCutoff: s.missedCheckInCutoff,
      messageWording: s.messageWording ?? 'NEUTRAL'
    };
  }

  get emailOff(): boolean {
    return this.current?.emailProvider === 'OFF';
  }

  get smsOff(): boolean {
    return this.current?.smsProvider === 'OFF';
  }

  get emailChip(): ChipSpec | null {
    return this.current ? providerChip(this.current.emailProvider) : null;
  }

  get smsChip(): ChipSpec | null {
    return this.current ? providerChip(this.current.smsProvider) : null;
  }

  touch(): void {
    this.saved = false;
  }

  /** The static example of the chosen wording (never rendered from the server: nothing new is fetched). */
  exampleKey(w: MessageWording | undefined): 'settings.notif.wordingExampleNeutral' | 'settings.notif.wordingExampleStandard' {
    return w !== 'STANDARD' ? 'settings.notif.wordingExampleNeutral' : 'settings.notif.wordingExampleStandard';
  }

  wordingLabelKey(w: MessageWording): 'settings.notif.wordingNeutral' | 'settings.notif.wordingStandard' {
    return w === 'NEUTRAL' ? 'settings.notif.wordingNeutral' : 'settings.notif.wordingStandard';
  }

  /** Mirrors the server rules so most mistakes are caught before the request. */
  validate(): Record<string, string> {
    const f = this.form;
    const e: Record<string, string> = {};
    if (!TIME.test(f.checkInReminderTime ?? '')) {
      e['checkInReminderTime'] = this.i18n.t('settings.notif.timeFormat');
    }
    if (!TIME.test(f.missedCheckInCutoff ?? '')) {
      e['missedCheckInCutoff'] = this.i18n.t('settings.notif.timeFormat');
    }
    if (!e['checkInReminderTime'] && !e['missedCheckInCutoff'] && f.checkInReminderTime >= f.missedCheckInCutoff) {
      e['checkInReminderTime'] = this.i18n.t('error.field.reminderBeforeCutoff');
    }
    const h = f.appointmentReminderHours;
    if (!Number.isInteger(h) || h < 24 || h > 72) {
      e['appointmentReminderHours'] = this.i18n.t('settings.notif.hoursRange');
    }
    return e;
  }

  save(): void {
    if (!this.current || this.saving) {
      return;
    }
    this.saved = false;
    this.banner = null;
    this.errors = this.validate();
    if (Object.keys(this.errors).length) {
      return;
    }
    this.saving = true;
    const body: NotificationSettingsRequest = { ...this.form };
    this.settings.updateNotifications(body).subscribe({
      next: s => {
        this.saving = false;
        this.saved = true;
        this.apply(s);
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (api && Object.keys(api.fieldErrors).length) {
          this.errors = this.apiErrors.fieldTexts(err);
        } else {
          this.banner = this.apiErrors.text(err, 'settings.notify.error.save');
        }
      }
    });
  }
}
