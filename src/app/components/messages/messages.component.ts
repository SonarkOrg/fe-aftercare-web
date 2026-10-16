import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessageService } from '../../Services/Message.service';
import { MessageCountService } from '../../Services/MessageCount.service';
import { I18nService } from '../../i18n/i18n.service';
import { Conversation } from '../../models/message.model';
import { businessDateOf, businessToday, initials } from '../../shared/link.util';
import { fmtDayShort, fmtTime } from '../../shared/messages.util';
import { ChipSpec, messagingChip } from '../../shared/status';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html'
})
export class MessagesComponent implements OnInit, OnDestroy {
  conversations: Conversation[] = [];
  selected: number | null = null;
  search = '';
  loading = true;
  error = false;
  readonly closedChip: ChipSpec = messagingChip(false, null);
  private sub = new Subscription();

  constructor(private messages: MessageService, private route: ActivatedRoute, private messageCount: MessageCountService, private i18n: I18nService) {}

  ngOnInit(): void {
    this.sub.add(this.route.paramMap.subscribe(p => {
      const id = Number(p.get('patientId'));
      this.selected = id > 0 ? id : null;
    }));
    this.loadInbox();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  loadInbox(): void {
    this.messages.inbox().subscribe({
      next: c => {
        this.conversations = c;
        this.loading = false;
        this.error = false;
        this.messageCount.report(this.unreadTotal);
      },
      error: () => {
        this.loading = false;
        this.error = true;
      }
    });
  }

  get unreadTotal(): number {
    return this.conversations.reduce((n, c) => n + c.unreadCount, 0);
  }

  get visible(): Conversation[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.conversations.filter(c => `${c.patientFirstName} ${c.patientLastName}`.toLowerCase().includes(q)) : this.conversations;
  }

  get selectedName(): string | null {
    const c = this.conversations.find(x => x.patientId === this.selected);
    return c ? `${c.patientFirstName} ${c.patientLastName}` : null;
  }

  initialsOf(c: Conversation): string {
    return initials(c.patientFirstName, c.patientLastName);
  }

  /** HH:mm for today, otherwise "d MMM" (America/Toronto). */
  when(c: Conversation): string {
    return businessDateOf(c.lastMessageAt) === businessToday() ? fmtTime(c.lastMessageAt, this.i18n.lang) : fmtDayShort(c.lastMessageAt, this.i18n.lang);
  }
}
