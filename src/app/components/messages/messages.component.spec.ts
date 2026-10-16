import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { MessageCountService } from '../../Services/MessageCount.service';
import { JANE, conversation, thread, providePermissions } from '../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { MessageThreadComponent } from '../../shared/message-thread/message-thread.component';
import { MessagesComponent } from './messages.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('MessagesComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const today = new Date().toISOString();

  const convs = [
    conversation({ patientId: 5, patientFirstName: 'Jane', patientLastName: 'Doe', unreadCount: 2, lastMessagePreview: 'Pain is worse', lastMessageAt: today }),
    conversation({ patientId: 6, patientFirstName: 'Jean', patientLastName: 'Roy', unreadCount: 0, lastSender: 'STAFF', lastMessagePreview: 'See you Monday', lastMessageAt: '2026-09-01T15:00:00Z', messagingOpen: false }),
    conversation({ patientId: 7, patientFirstName: 'Sophie', patientLastName: 'Lavoie', unreadCount: 1, lastMessagePreview: 'Thanks', lastMessageAt: '2026-09-02T15:00:00Z' })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterModule],
      declarations: [MessagesComponent, MessageThreadComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), 
        provideRouter([{ path: 'messages', component: MessagesComponent }, { path: 'messages/:patientId', component: MessagesComponent }]),
        { provide: MessageCountService, useValue: { refresh: jasmine.createSpy('refresh'), report: jasmine.createSpy('report') } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http.verify());

  const inbox = () => http.expectOne(`${api}/messages/inbox`);
  async function open(url = '/messages', list = convs) {
    const c = await harness.navigateByUrl(url, MessagesComponent);
    inbox().flush(list);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    return c;
  }
  const rows = () => Array.from(el.querySelectorAll<HTMLAnchorElement>('.conv-row'));
  const names = () => rows().map(r => r.querySelector('.row__name')!.textContent!.trim());

  it('shows the title and the subtitle', async () => {
    await open();
    expect(el.querySelector('h1')!.textContent).toBe('Messages');
    expect(el.querySelector('.hero__sub')!.textContent).toBe('Secure messages with patients who have an active link. Not monitored outside clinic hours.');
  });

  it('keeps the inbox order as received and links each row to its conversation', async () => {
    await open();
    expect(names()).toEqual(['Jane Doe', 'Jean Roy', 'Sophie Lavoie']);
    expect(rows().map(r => r.getAttribute('href'))).toEqual(['/messages/5', '/messages/6', '/messages/7']);
    expect(el.querySelector('.msg-list .card__title--sm .badge')!.textContent).toBe('3'); // conversations listed
    expect(el.querySelector('.msg-list .conv-unread')!.textContent).toBe(' · 3 unread'); // 2 + 0 + 1
  });

  it('header reads "conversations listed · unread total" when there are unread messages', async () => {
    await open();
    expect(el.querySelector('.msg-list .card__title--sm')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Conversations 3 · 3 unread');
  });

  it('header omits the unread part when nothing is unread', async () => {
    const reads = [conversation({ patientId: 5, unreadCount: 0 }), conversation({ patientId: 6, unreadCount: 0 })];
    await open('/messages', reads);
    expect(el.querySelector('.msg-list .card__title--sm .badge')!.textContent).toBe('2');
    expect(el.querySelector('.msg-list .conv-unread')).toBeNull();
    expect(el.querySelector('.msg-list .card__title--sm')!.textContent).not.toContain('unread');
  });

  it('reports the inbox unread total to the top-bar count after a load, so both show the same number', async () => {
    await open();
    const count = TestBed.inject(MessageCountService) as unknown as { report: jasmine.Spy };
    expect(count.report).toHaveBeenCalledWith(3);
  });

  it('does not report a count when the inbox fails to load', async () => {
    await harness.navigateByUrl('/messages', MessagesComponent);
    inbox().flush('x', { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    const count = TestBed.inject(MessageCountService) as unknown as { report: jasmine.Spy };
    expect(count.report).not.toHaveBeenCalled();
  });

  it('shows the preview ("You: " for staff), the unread pill with an accessible name, and a Closed chip', async () => {
    await open();
    const [jane, jean] = rows();
    expect(jane.querySelector('.conv-preview')!.textContent).toBe('Pain is worse');
    expect(jane.querySelector('.badge-count')!.textContent).toBe('2 unread');
    expect(jane.querySelector('.badge-count .sr-only')!.textContent).toBe(' unread');
    expect(jane.querySelector('.badge-count')!.hasAttribute('aria-label')).toBeFalse(); // aria-label is not announced on a plain span
    expect(jane.querySelector('.row__name')!.classList).toContain('is-unread');
    expect(jane.querySelector('app-status-chip')).toBeNull();
    expect(jean.querySelector('.conv-preview')!.textContent).toBe('You: See you Monday');
    expect(jean.querySelector('.badge-count')).toBeNull();
    expect(jean.querySelector('.row__name')!.classList).not.toContain('is-unread');
    expect(jean.querySelector('app-status-chip .chip__label')!.textContent).toBe('Closed');
    expect(jean.querySelector('app-status-chip .chip__glyph')!.textContent).toBe('⊘');
  });

  it('shows HH:mm for today and "d MMM" for older messages', async () => {
    await open();
    const [jane, jean] = rows();
    expect(jane.querySelector('.conv-time')!.textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(jean.querySelector('.conv-time')!.textContent).toBe('1 Sept');
  });

  it('filters the conversations by name on the client', async () => {
    await open();
    const input = el.querySelector<HTMLInputElement>('.msg-search input')!;
    input.value = 'roy';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(names()).toEqual(['Jean Roy']);
    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(rows().length).toBe(0);
    expect(el.textContent).toContain('No conversation matches.');
    http.expectNone(`${api}/messages/inbox`); // no new request
  });

  it('shows the empty states', async () => {
    await open('/messages', []);
    expect(el.textContent).toContain('No conversations yet.');
    expect(el.textContent).toContain('Select a conversation.');
  });

  it('selecting a conversation navigates to /messages/:id', async () => {
    await open();
    rows()[0].click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/messages/5');
    harness.detectChanges(); // the new route's component initialises
    // the new route loads the inbox again, then shows the selected thread
    inbox().flush(convs);
    harness.detectChanges();
    http.expectOne(r => r.url === `${api}/patients/5/messages`).flush(thread({ items: [] }));
    harness.detectChanges();
  });

  it('opens a conversation from the URL: marks the row current and shows the thread with the inbox name', async () => {
    await harness.navigateByUrl('/messages/5', MessagesComponent);
    inbox().flush(convs);
    harness.detectChanges();
    http.expectOne(r => r.url === `${api}/patients/5/messages`).flush(thread({ items: [] }));
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(rows()[0].getAttribute('aria-current')).toBe('true');
    expect(rows()[1].hasAttribute('aria-current')).toBeFalse();
    expect(el.querySelector('app-message-thread')).not.toBeNull();
    expect(el.querySelector('.thread-who')!.textContent).toBe('Jane Doe');
    expect(el.querySelector('.grid-msg')!.classList).toContain('has-selection');
    expect(el.querySelector('.msg-back')!.getAttribute('href')).toBe('/messages');
    expect(el.textContent).not.toContain('Select a conversation.');
  });

  it('fetches the patient name for a conversation that is not in the inbox yet', async () => {
    await harness.navigateByUrl('/messages/9', MessagesComponent);
    inbox().flush(convs);
    harness.detectChanges();
    http.expectOne(r => r.url === `${api}/patients/9/messages`).flush(thread({ patientId: 9 }));
    http.expectOne(`${api}/patients/9`).flush({ ...JANE, id: 9, firstName: 'New', lastName: 'Person' });
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('.thread-who')!.textContent).toBe('New Person');
  });

  it('shows a retry when the inbox fails to load', async () => {
    await harness.navigateByUrl('/messages', MessagesComponent);
    inbox().flush('x', { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Could not load the conversations');
  });
});
