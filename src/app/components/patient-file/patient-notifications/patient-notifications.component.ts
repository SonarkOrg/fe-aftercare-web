import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { NotificationService } from '../../../Services/Notification.service';
import { SettingsService } from '../../../Services/Settings.service';
import { apiErrorOf, errorText } from '../../../models/api-error.model';
import {
  ContactConsent, ContactPreferences, ContactPreferencesRequest, NotificationChannel, NotificationItem, NotificationStatus, NotificationTemplate
} from '../../../models/notification.model';
import { Language } from '../../../models/settings.model';
import { businessNow, humanize } from '../../../shared/link.util';
import { ChipSpec } from '../../../shared/status';

export const TEMPLATE_LABEL: Record<NotificationTemplate, string> = {
  FOLLOW_UP_LINK: 'Follow-up link', CHECKIN_REMINDER: 'Check-in reminder', APPOINTMENT_LINK: 'Questionnaire link', APPOINTMENT_REMINDER: 'Questionnaire reminder'
};

export const STATUS_CHIP: Record<NotificationStatus, ChipSpec> = {
  PENDING: { tone: 'neutral', glyph: '—', label: 'Queued' },
  SENDING: { tone: 'neutral', glyph: '—', label: 'Sending' },
  SENT: { tone: 'good', glyph: '✓', label: 'Sent' },
  FAILED: { tone: 'critical', glyph: '▲', label: 'Failed' },
  CANCELLED: { tone: 'warning', glyph: '●', label: 'Cancelled' },
  SKIPPED: { tone: 'neutral', glyph: '—', label: 'Not needed' }
};

export const UNAVAILABLE_HINT = 'Not available (check the address or ask an admin to enable this channel)';

const LANG_LABEL: Record<Language, string> = { FR: 'Français', EN: 'English' };

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
  readonly humanize = humanize;

  constructor(private notifications: NotificationService, private settings: SettingsService) {}

  ngOnInit(): void {
    this.settings.clinic$.pipe(take(1)).subscribe({ next: c => (this.clinicDefault = c.defaultLanguage), error: () => { /* keep FR */ } });
    this.loadPrefs();
    this.loadHistory();
    this.sub = this.notifications.sent$.subscribe(id => {
      if (id === this.patientId) {
        this.loadHistory();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadPrefs(): void {
    this.loadError = null;
    this.notifications.preferences(this.patientId).subscribe({
      next: p => this.apply(p),
      error: err => (this.loadError = errorText(err, 'Could not load the notification preferences.'))
    });
  }

  loadHistory(): void {
    this.historyError = null;
    this.notifications.list(this.patientId, 0, 20).subscribe({
      next: p => {
        this.history = p.items;
        this.historyLoaded = true;
      },
      error: err => (this.historyError = errorText(err, 'Could not load the recent messages.'))
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
    return `Clinic default (${LANG_LABEL[this.clinicDefault]})`;
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
          this.errors = { ...api.fieldErrors };
        } else {
          this.banner = errorText(err, 'Could not save the preferences.');
        }
      }
    });
  }

  /* ---------- history ---------- */

  chip(n: NotificationItem): ChipSpec {
    return STATUS_CHIP[n.status];
  }

  channelLabel(c: NotificationChannel): string {
    return c === 'EMAIL' ? 'Email' : 'SMS';
  }

  when(iso: string): string {
    return businessNow(new Date(iso)).slice(0, 16).replace('T', ' ');
  }
}
