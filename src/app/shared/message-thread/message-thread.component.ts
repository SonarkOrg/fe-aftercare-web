import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { MessageService } from '../../Services/Message.service';
import { MessageCountService } from '../../Services/MessageCount.service';
import { PatientService } from '../../Services/Patient.service';
import { apiErrorOf } from '../../models/api-error.model';
import { Message } from '../../models/message.model';
import { ChipSpec, messagingChip } from '../status';
import { DayGroup, fmtTime, groupByDay } from '../messages.util';

export const MESSAGE_MAX = 2000;
const CLOSED = 'Messaging is closed: the patient has no active link. Create a follow-up or appointment to reopen it. History stays available.';

/** Staff view of one patient's message thread, with the composer. Plain text only (Angular escapes the interpolation). */
@Component({
  selector: 'app-message-thread',
  templateUrl: './message-thread.component.html'
})
export class MessageThreadComponent implements OnInit, OnChanges, OnDestroy {
  @Input() patientId = 0;
  @Input() variant: 'page' | 'embedded' = 'page';
  /** Known by the inbox; fetched from the patient when absent (page variant). */
  @Input() patientName: string | null = null;
  /** Emitted whenever messages were marked read, so a parent can refresh its own unread count. */
  @Output() read = new EventEmitter<void>();
  /** Emitted after a message was sent, so a parent (the inbox) can refresh its preview. */
  @Output() sent = new EventEmitter<void>();

  items: Message[] = [];
  groups: DayGroup<Message>[] = [];
  hasMore = false;
  open = true;
  openUntil: string | null = null;
  loading = true;
  loadError = false;
  sending = false;
  sendError: string | null = null;
  draft = '';
  name: string | null = null;
  readonly max = MESSAGE_MAX;
  readonly closedText = CLOSED;

  @ViewChild('log') log?: ElementRef<HTMLElement>;

  private poll?: Subscription;
  private seq = 0;

  constructor(private messages: MessageService, private count: MessageCountService, private patients: PatientService) {}

  get chip(): ChipSpec {
    return messagingChip(this.open, this.openUntil);
  }

  get canSend(): boolean {
    return this.open && !this.sending && this.draft.trim().length > 0 && this.draft.length <= this.max;
  }

  time(m: Message): string {
    return fmtTime(m.sentAt, 'en');
  }

  who(m: Message): string {
    return m.senderName ?? (m.sender === 'PATIENT' ? 'Patient' : 'Staff');
  }

  ngOnInit(): void {
    if (this.variant === 'page') {
      this.poll = interval(30_000).subscribe(() => {
        if (document.visibilityState === 'visible' && !this.loading) {
          this.refreshNewest();
        }
      });
    }
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['patientId'] && this.patientId) {
      this.items = [];
      this.groups = [];
      this.draft = '';
      this.sendError = null;
      this.sending = false;
      this.hasMore = false;
      this.open = true;
      this.openUntil = null;
      this.name = this.patientName;
      this.load();
      if (this.variant === 'page' && !this.patientName) {
        const id = this.patientId;
        this.patients.getPatient(id).subscribe({
          next: p => { if (id === this.patientId) { this.name = `${p.firstName} ${p.lastName}`; } },
          error: () => { /* the head just shows "Patient" */ }
        });
      }
    } else if (c['patientName']) {
      this.name = this.patientName;
    }
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  load(): void {
    const ticket = ++this.seq;
    this.loading = true;
    this.loadError = false;
    this.messages.thread(this.patientId).subscribe({
      next: t => {
        if (ticket !== this.seq) {
          return;
        }
        this.items = t.items;
        this.hasMore = t.hasMore;
        this.open = t.messagingOpen;
        this.openUntil = t.messagingOpenUntil;
        this.loading = false;
        this.regroup();
        this.scrollDown();
        this.markRead();
      },
      error: () => {
        if (ticket === this.seq) {
          this.loading = false;
          this.loadError = true;
        }
      }
    });
  }

  loadEarlier(): void {
    const first = this.items[0];
    if (!first) {
      return;
    }
    const pid = this.patientId;
    this.messages.thread(pid, first.id).subscribe({
      next: t => {
        if (pid !== this.patientId) {
          return;
        }
        this.items = this.merge(t.items, this.items);
        this.hasMore = t.hasMore;
        this.regroup();
      },
      error: () => {
        if (pid === this.patientId) {
          this.sendError = 'Could not load earlier messages.';
        }
      }
    });
  }

  private refreshNewest(): void {
    const ticket = this.seq;
    this.messages.thread(this.patientId).subscribe({
      next: t => {
        if (ticket !== this.seq) {
          return;
        }
        const before = this.items.length;
        this.items = this.merge(this.items, t.items);
        this.open = t.messagingOpen;
        this.openUntil = t.messagingOpenUntil;
        this.regroup();
        if (this.items.length !== before) {
          this.scrollDown();
        }
        this.markRead();
      },
      error: () => { /* keep what is shown */ }
    });
  }

  /** Union by id (the later list wins), ascending. */
  private merge(a: Message[], b: Message[]): Message[] {
    const byId = new Map<number, Message>();
    for (const m of [...a, ...b]) {
      byId.set(m.id, m);
    }
    return [...byId.values()].sort((x, y) => x.id - y.id);
  }

  private regroup(): void {
    this.groups = groupByDay(this.items, 'en');
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.log?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  /** Marks the patient's messages read up to the newest one, then refreshes the top-bar count. */
  private markRead(): void {
    const unread = this.items.filter(m => m.sender === 'PATIENT' && !m.readByStaffAt);
    if (!unread.length) {
      return;
    }
    const upTo = Math.max(...this.items.filter(m => m.sender === 'PATIENT').map(m => m.id));
    const pid = this.patientId;
    this.messages.markRead(pid, upTo).subscribe({
      next: () => {
        if (pid !== this.patientId) {
          return;
        }
        const now = new Date().toISOString();
        this.items = this.items.map(m => (m.sender === 'PATIENT' && m.id <= upTo && !m.readByStaffAt ? { ...m, readByStaffAt: now } : m));
        this.count.refresh();
        this.read.emit();
      },
      error: () => { /* it will be retried on the next load */ }
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
    const pid = this.patientId;
    this.sending = true;
    this.sendError = null;
    this.messages.send(pid, this.draft.trim()).subscribe({
      next: m => {
        if (pid !== this.patientId) {
          return; // the patient changed meanwhile: this reply belongs to another thread
        }
        this.sending = false;
        this.draft = '';
        this.items = this.merge(this.items, [m]);
        this.regroup();
        this.scrollDown();
        this.sent.emit();
        this.markRead();
      },
      error: err => {
        if (pid !== this.patientId) {
          return;
        }
        this.sending = false;
        const api = apiErrorOf(err);
        if (api?.error === 'MESSAGING_CLOSED') {
          this.open = false;
          this.openUntil = null;
        } else if (err?.status === 400) {
          this.sendError = 'The message must be plain text, 1 to 2,000 characters.';
        } else {
          this.sendError = 'Could not send the message. Try again.';
        }
      }
    });
  }
}
