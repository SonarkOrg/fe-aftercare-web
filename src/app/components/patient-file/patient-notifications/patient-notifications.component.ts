import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { NotificationService } from '../../../Services/Notification.service';
import { SettingsService } from '../../../Services/Settings.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { fmtDate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { TKey } from '../../../i18n/i18n.types';
import { apiErrorOf } from '../../../models/api-error.model';
import {
  ContactConsent, ContactPreferences, ContactPreferencesRequest, NotificationChannel, NotificationItem, NotificationStatus, NotificationTemplate
} from '../../../models/notification.model';
import { Language } from '../../../models/settings.model';
import { ChipSpec } from '../../../shared/status';

export const TEMPLATE_LABEL: Record<NotificationTemplate, TKey> = {
  FOLLOW_UP_LINK: 'enum.notificationTemplate.FOLLOW_UP_LINK', CHECKIN_REMINDER: 'enum.notificationTemplate.CHECKIN_REMINDER',
  APPOINTMENT_LINK: 'enum.notificationTemplate.APPOINTMENT_LINK', APPOINTMENT_REMINDER: 'enum.notificationTemplate.APPOINTMENT_REMINDER'
};

export const STATUS_CHIP: Record<NotificationStatus, ChipSpec> = {
  PENDING: { tone: 'neutral', glyph: '—', label: { key: 'enum.notificationStatus.PENDING' } },
  SENDING: { tone: 'neutral', glyph: '—', label: { key: 'enum.notificationStatus.SENDING' } },
  SENT: { tone: 'good', glyph: '✓', label: { key: 'enum.notificationStatus.SENT' } },
  FAILED: { tone: 'critical', glyph: '▲', label: { key: 'enum.notificationStatus.FAILED' } },
  CANCELLED: { tone: 'warning', glyph: '●', label: { key: 'enum.notificationStatus.CANCELLED' } },
  SKIPPED: { tone: 'neutral', glyph: '—', label: { key: 'enum.notificationStatus.SKIPPED' } }
};

export const UNAVAILABLE_HINT: TKey = 'pf.notif.unavailable';

const LANG_LABEL: Record<Language, string> = { FR: 'Français', EN: 'English' }; // language names are never translated

/** Contact preferences, consent and the recent messages of one patient (Contacts tab). */
@Component({
  selector: 'app-patient-notifications',
  templateUrl: './patient-notifications.component.html'
})
export class PatientNotificationsComponent implements OnInit, OnDestroy {
  @Input() patientId = 0;
  @Output() saved = new EventEmitter<ContactPreferences>();
  private sub?: Subscription;

  prefs: ContactPreferences | null = null;
  consent: ContactConsent = 'UNKNOWN';
  channel: NotificationChannel = 'EMAIL';
  /** '' = the clinic default. */
  language: '' | Language = '';
  clinicDefault: Language = 'FR';
  loadError: string | null = null;
  saving = false;
  showSaved = false;
  banner: string | null = null;
  errors: Record<string, string> = {};

  history: NotificationItem[] = [];
  historyLoaded = false;
  historyError: string | null = null;

  readonly hint = UNAVAILABLE_HINT;
  readonly templateLabel = TEMPLATE_LABEL;

  constructor(private notifications: NotificationService, private settings: SettingsService, private i18n: I18nService, private apiErrors: ApiErrorsService) {}

  get hintText(): string {
    return this.i18n.t(this.hint);
  }

  ngOnInit(): void {
    this.settings.clinic$.pipe(take(1)).subscribe({ next: c => (this.clinicDefault = c.defaultLanguage), error: () => { /* keep FR */ } });
    this.loadPrefs();
    this.loadHistory();
    this.sub = this.notifications.sent$.subscribe(id => {
      if (id === this.patientId) {
        this.loadHistory();
      }
    });
    this.sub.add(this.notifications.prefsChanged$.subscribe(p => {
      if (p.patientId === this.patientId) {
        this.apply(p);
        this.showSaved = false;
        this.loadHistory(); // queued messages on the changed channel were cancelled
      }
    }));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadPrefs(): void {
    this.loadError = null;
    this.notifications.preferences(this.patientId).subscribe({
      next: p => this.apply(p),
      error: err => (this.loadError = this.apiErrors.text(err, 'pf.notif.error.load'))
    });
  }

  loadHistory(): void {
    this.historyError = null;
    this.notifications.list(this.patientId, 0, 20).subscribe({
      next: p => {
        this.history = p.items;
        this.historyLoaded = true;
      },
      error: err => (this.historyError = this.apiErrors.text(err, 'pf.notif.error.history'))
    });
  }

  private apply(p: ContactPreferences): void {
    this.prefs = p;
    this.consent = p.contactConsent;
    this.channel = p.preferredChannel;
    this.language = p.language ?? '';
  }

  /** Once GRANTED or WITHDRAWN was saved, "Not recorded" can no longer be chosen. */
  get unknownLocked(): boolean {
    return !!this.prefs && this.prefs.contactConsent !== 'UNKNOWN';
  }

  get defaultLabel(): string {
    return this.i18n.t('pf.notif.clinicDefault', { language: LANG_LABEL[this.clinicDefault] });
  }

  available(c: NotificationChannel): boolean {
    return !!this.prefs && (c === 'EMAIL' ? this.prefs.emailAvailable : this.prefs.smsAvailable);
  }

  touch(): void {
    this.showSaved = false;
  }

  save(): void {
    if (!this.prefs || this.saving) {
      return;
    }
    this.saving = true;
    this.showSaved = false;
    this.banner = null;
    this.errors = {};
    const body: ContactPreferencesRequest = { preferredChannel: this.channel, language: this.language || null, contactConsent: this.consent };
    this.notifications.savePreferences(this.patientId, body).subscribe({
      next: p => {
        this.saving = false;
        this.showSaved = true;
        this.apply(p);
        this.saved.emit(p);
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (api && Object.keys(api.fieldErrors).length) {
          this.errors = this.apiErrors.fieldTexts(err);
        } else {
          this.banner = this.apiErrors.text(err, 'pf.notif.error.save');
        }
      }
    });
  }

  /* ---------- history ---------- */

  chip(n: NotificationItem): ChipSpec {
    return STATUS_CHIP[n.status];
  }

  channelLabel(c: NotificationChannel): string {
    return this.i18n.t(`enum.notificationChannel.${c}` as TKey);
  }

  when(iso: string): string {
    return fmtDate(iso, 'isoDateTime', this.i18n.lang);
  }
}
