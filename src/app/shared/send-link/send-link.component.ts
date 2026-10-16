import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { NotificationService } from '../../Services/Notification.service';
import { apiErrorOf, errorText } from '../../models/api-error.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContactPreferences, NotificationChannel, NotificationItem } from '../../models/notification.model';

export interface ChannelOption { channel: NotificationChannel | null; label: string }

const CHANNEL_WORD: Record<NotificationChannel, string> = { EMAIL: 'email', SMS: 'SMS' };

/** "Send link": queues the patient link by email or SMS (consent, channel and address are checked by the server). */
@Component({
  selector: 'app-send-link',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './send-link.component.html'
})
export class SendLinkComponent {
  @Input() kind: 'follow-up' | 'appointment' = 'follow-up';
  @Input() targetId = 0;
  @Input() patientId = 0;
  @Output() sent = new EventEmitter<NotificationItem>();

  open = false;
  busy = false;
  loadingPrefs = false;
  prefs: ContactPreferences | null = null;
  success: string | null = null;
  error: string | null = null;
  /** True when the error is NO_CONSENT: the banner then links to the Contacts tab. */
  noConsent = false;

  constructor(private notifications: NotificationService, private host: ElementRef<HTMLElement>) {}

  /** Computed once per preferences load (no getter: stable references for the menu). */
  options: ChannelOption[] = [];

  trackChannel = (_: number, o: ChannelOption): string => o.channel ?? 'preferred';

  private buildOptions(p: ContactPreferences): ChannelOption[] {
    const other: NotificationChannel = p.preferredChannel === 'EMAIL' ? 'SMS' : 'EMAIL';
    const otherAvailable = other === 'EMAIL' ? p.emailAvailable : p.smsAvailable;
    const out: ChannelOption[] = [{ channel: null, label: `By ${CHANNEL_WORD[p.preferredChannel]} (preferred)` }];
    if (otherAvailable) {
      out.push({ channel: other, label: `By ${CHANNEL_WORD[other]}` });
    }
    return out;
  }

  toggle(): void {
    if (this.open) {
      this.open = false;
      return;
    }
    this.error = null;
    this.noConsent = false;
    this.success = null;
    this.open = true;
    // Always reload so the "(preferred)" label matches what the server will use.
    this.prefs = null;
    this.options = [];
    this.loadingPrefs = true;
    this.notifications.preferences(this.patientId).subscribe({
      next: p => {
        this.prefs = p;
        this.options = this.buildOptions(p);
        this.loadingPrefs = false;
        this.focusFirst();
      },
      error: err => {
        this.loadingPrefs = false;
        this.open = false;
        this.error = errorText(err, 'Could not load the contact preferences.');
      }
    });
  }

  onMenuKey(e: KeyboardEvent): void {
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.send-link__item'));
    if (!items.length) {
      return;
    }
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (e.key === 'ArrowDown') {
      next = (i + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
      next = (i - 1 + items.length) % items.length;
    } else {
      return;
    }
    e.preventDefault();
    items[next].focus();
  }

  private focusFirst(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.send-link__item')?.focus());
  }

  send(o: ChannelOption): void {
    this.open = false;
    this.busy = true;
    this.error = null;
    this.noConsent = false;
    this.success = null;
    const call = this.kind === 'follow-up'
      ? this.notifications.sendFollowUpLink(this.targetId, o.channel)
      : this.notifications.sendAppointmentLink(this.targetId, o.channel);
    call.subscribe({
      next: n => {
        this.busy = false;
        this.success = `Link queued for ${CHANNEL_WORD[n.channel]} to ${n.recipientMasked ?? 'the patient'}.`;
        this.sent.emit(n);
      },
      error: err => {
        this.busy = false;
        this.error = this.messageFor(err);
      }
    });
  }

  private messageFor(err: unknown): string {
    switch (apiErrorOf(err)?.error) {
      case 'NO_CONSENT':
        this.noConsent = true;
        return "The patient's consent to notifications isn't recorded. Update it in Contacts.";
      case 'CHANNEL_DISABLED': return 'This channel is disabled in Settings.';
      case 'NO_RECIPIENT': return 'The patient has no valid address for this channel.';
      case 'LINK_UNAVAILABLE': return 'Generate a new link first, then send it.';
      default: return errorText(err, 'Could not send the link.');
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.open = false;
      this.host.nativeElement.querySelector<HTMLElement>('.send-link__btn')?.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.open && !this.host.nativeElement.contains(e.target as Node)) {
      this.open = false;
    }
  }
}
