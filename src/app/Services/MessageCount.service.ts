import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, interval } from 'rxjs';
import { MessageService } from './Message.service';

/** Unread patient messages for the top-bar badge. Refreshes on demand and every 60 s while the tab is visible. */
@Injectable({ providedIn: 'root' })
export class MessageCountService implements OnDestroy {
  readonly unread$ = new BehaviorSubject<number>(0);
  private timer: Subscription | null = null;

  constructor(private messages: MessageService) {}

  /**
   * Sets the count from a source that already holds the unread total (the inbox, once loaded), so the top bar
   * and the inbox header show the same number. The next refresh() re-reads the server total.
   */
  report(unread: number): void {
    this.unread$.next(unread);
  }

  refresh(): void {
    this.messages.unreadCount().subscribe({
      next: c => this.unread$.next(c.unreadMessages),
      error: () => { /* keep the previous value */ }
    });
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = interval(60_000).subscribe(() => {
      if (document.visibilityState === 'visible') {
        this.refresh();
      }
    });
  }

  stop(): void {
    this.timer?.unsubscribe();
    this.timer = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
