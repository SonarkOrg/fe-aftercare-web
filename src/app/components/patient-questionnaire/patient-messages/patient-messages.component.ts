import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { PublicMessageService } from '../../../Services/PublicMessage.service';
import { PublicMessage } from '../../../models/message.model';
import { fmtTime } from '../../../shared/messages.util';
import { PatientLang, QUESTIONNAIRE_TEXT } from '../patient-questionnaire.i18n';
import { PATIENT_MESSAGES_TEXT, PatientMessagesText } from './patient-messages.i18n';

export const BODY_MAX = 2000;

/** The patient's side of the secure messages: plain text, French by default, no staff identifiers. */
@Component({
  selector: 'app-patient-messages',
  templateUrl: './patient-messages.component.html'
})
export class PatientMessagesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() code = '';
  @Input() lang: PatientLang = 'fr';
  /** Unread clinic messages after each load (0 once they were marked as seen). */
  @Output() unread = new EventEmitter<number>();
  /** The link is no longer valid (404): the page switches to its invalid state. */
  @Output() invalid = new EventEmitter<void>();

  items: PublicMessage[] = [];
  hasMore = false;
  clinicName = '';
  clinicPhone: string | null = null;
  loading = true;
  sending = false;
  draft = '';
  errorKey: 'error' | 'rateLimited' | 'invalidBody' | null = null;
  readonly max = BODY_MAX;
  private failed: 'load' | 'send' = 'load';

  @ViewChild('log') log?: ElementRef<HTMLElement>;
  private poll?: Subscription;
  private seq = 0;

  constructor(private service: PublicMessageService) {}

  get t(): PatientMessagesText {
    return PATIENT_MESSAGES_TEXT[this.lang];
  }

  get retryText(): string {
    return QUESTIONNAIRE_TEXT[this.lang].retry;
  }

  get counter(): string {
    return this.t.counter.replace('{n}', String(this.draft.length));
  }

  get canSend(): boolean {
    return !this.sending && this.draft.trim().length > 0 && this.draft.length <= BODY_MAX;
  }

  time(m: PublicMessage): string {
    return fmtTime(m.sentAt, this.lang);
  }

  who(m: PublicMessage): string {
    return m.sender === 'PATIENT' ? this.t.you : (m.senderName ?? this.t.careTeam);
  }

  ngOnInit(): void {
    this.poll = interval(30_000).subscribe(() => {
      if (document.visibilityState === 'visible' && !this.loading) {
        this.load(true);
      }
    });
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['code'] && this.code) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  load(quiet = false): void {
    const ticket = ++this.seq;
    if (!quiet) {
      this.loading = true;
      this.errorKey = null;
    }
    this.service.thread(this.code).subscribe({
      next: t => {
        if (ticket !== this.seq) {
          return;
        }
        const before = this.items.length;
        this.items = this.merge(quiet ? this.items : [], t.items);
        this.hasMore = t.hasMore;
        this.clinicName = t.clinicName;
        this.clinicPhone = t.clinicPhone;
        this.loading = false;
        if (!quiet || this.items.length !== before) {
          this.scrollDown();
        }
        this.markSeen(t.unreadCount);
      },
      error: err => {
        if (ticket !== this.seq) {
          return;
        }
        this.loading = false;
        if (err?.status === 404) {
          this.invalid.emit();
        } else if (!quiet) {
          this.failed = 'load';
          this.errorKey = 'error';
        }
      }
    });
  }

  loadEarlier(): void {
    const first = this.items[0];
    if (!first) {
      return;
    }
    this.service.thread(this.code, first.id).subscribe({
      next: t => {
        this.items = this.merge(t.items, this.items);
        this.hasMore = t.hasMore;
      },
      error: err => (err?.status === 404 ? this.invalid.emit() : (this.errorKey = 'error'))
    });
  }

  private merge(a: PublicMessage[], b: PublicMessage[]): PublicMessage[] {
    const byId = new Map<number, PublicMessage>();
    for (const m of [...a, ...b]) {
      byId.set(m.id, m);
    }
    return [...byId.values()].sort((x, y) => x.id - y.id);
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.log?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  /** Marks the clinic's messages as seen up to the newest one. */
  private markSeen(serverUnread: number): void {
    const staff = this.items.filter(m => m.sender === 'STAFF');
    if (!staff.some(m => !m.seen) && serverUnread === 0) {
      this.unread.emit(0);
      return;
    }
    const upTo = Math.max(0, ...staff.map(m => m.id));
    if (upTo === 0) {
      this.unread.emit(serverUnread);
      return;
    }
    this.service.markRead(this.code, upTo).subscribe({
      next: () => {
        this.items = this.items.map(m => (m.sender === 'STAFF' ? { ...m, seen: true } : m));
        this.unread.emit(0);
      },
      error: () => this.unread.emit(serverUnread)
    });
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.send();
    }
  }

  send(): void {
    if (!this.canSend) {
      return;
    }
    this.sending = true;
    this.errorKey = null;
    this.service.send(this.code, this.draft.trim()).subscribe({
      next: m => {
        this.sending = false;
        this.draft = '';
        this.items = this.merge(this.items, [m]);
        this.scrollDown();
      },
      error: err => {
        this.sending = false;
        if (err?.status === 404) {
          this.invalid.emit();
        } else if (err?.status === 429) {
          this.errorKey = 'rateLimited';
        } else if (err?.status === 400) {
          this.errorKey = 'invalidBody';
        } else {
          this.failed = 'send';
          this.errorKey = 'error';
        }
      }
    });
  }

  retry(): void {
    this.errorKey = null;
    if (this.failed === 'send') {
      this.send();
    } else {
      this.load();
    }
  }
}
