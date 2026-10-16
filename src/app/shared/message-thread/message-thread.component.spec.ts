import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { MessageCountService } from '../../Services/MessageCount.service';
import { JANE, message, thread, providePermissions } from '../../testing/fixtures';
import { AccessRole } from '../../models/me.model';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { MessageThreadComponent } from './message-thread.component';

describe('MessageThreadComponent', () => {
  let fixture: ComponentFixture<MessageThreadComponent>;
  let component: MessageThreadComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  let refresh: jasmine.Spy;
  const api = environment.apiUrl;
  const threadReq = (before?: string) => http.expectOne(r => r.url === `${api}/patients/5/messages` && r.method === 'GET' && r.params.get('before') === (before ?? null));

  beforeEach(async () => {
    refresh = jasmine.createSpy('refresh');
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [MessageThreadComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), { provide: MessageCountService, useValue: { refresh } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MessageThreadComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });
  afterEach(() => {
    jasmine.clock().uninstall();
    http.verify();
  });

  /** Mimics the parent binding: inputs first, ngOnChanges, then the first change detection (ngOnInit). */
  async function start(variant: 'page' | 'embedded' = 'embedded', name: string | null = 'Jane Doe') {
    component.variant = variant;
    component.patientId = 5;
    component.patientName = name;
    component.ngOnChanges({ patientId: new SimpleChange(0, 5, true) });
    await settle();
  }
  async function load(t = thread(), variant: 'page' | 'embedded' = 'embedded') {
    await start(variant);
    threadReq().flush(t);
    await settle();
  }
  /** ngModel connects its controls (and writes values / disabled) in a microtask: wait for it, then render. */
  const settle = async () => {
    fixture.detectChanges();
    for (let i = 0; i < 3; i++) {
      await Promise.resolve(); // the page variant polls (a pending timer), so whenStable() would never resolve
    }
    fixture.detectChanges();
  };
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const type = async (value: string) => {
    const ta = q<HTMLTextAreaElement>('textarea');
    ta.value = value;
    ta.dispatchEvent(new Event('input'));
    await settle();
  };

  it('renders staff bubbles right-aligned and patient bubbles left, with time, author and Seen', async () => {
    await load(thread({ items: [
      message({ id: 1, body: 'Hello', readByStaffAt: 'x' }),
      message({ id: 2, sender: 'STAFF', senderName: 'Marie Nurse', body: 'Hi there', readByPatientAt: '2026-10-14T16:00:00Z' }),
      message({ id: 3, sender: 'STAFF', senderName: null, body: 'Unseen reply' })
    ] }));
    const bubbles = el.querySelectorAll('.msg');
    expect(bubbles.length).toBe(3);
    expect(bubbles[0].classList).not.toContain('msg--me');
    expect(bubbles[1].classList).toContain('msg--me');
    expect(bubbles[0].querySelector('.msg__meta')!.textContent).toBe('11:00 · Patient');
    expect(bubbles[1].querySelector('.msg__meta')!.textContent).toBe('11:00 · Marie Nurse · Seen');
    expect(bubbles[2].querySelector('.msg__meta')!.textContent).toBe('11:00 · Staff');
    expect(q('.thread').getAttribute('role')).toBe('log');
    expect(q('.thread').getAttribute('aria-live')).toBe('polite');
  });

  it('groups by Toronto day with a separator', async () => {
    await load(thread({ items: [
      message({ id: 1, sentAt: '2026-10-14T03:30:00Z', readByStaffAt: 'x' }),
      message({ id: 2, sentAt: '2026-10-14T15:00:00Z', readByStaffAt: 'x' })
    ] }));
    expect(Array.from(el.querySelectorAll('.label-day')).map(h => h.textContent!.trim())).toEqual(['Tuesday 13 October', 'Wednesday 14 October']);
  });

  it('shows message text escaped: an HTML body is literal text and creates no element', async () => {
    await load(thread({ items: [message({ id: 1, body: '<img src=x onerror=alert(1)>', readByStaffAt: 'x' }), message({ id: 2, sender: 'STAFF', body: '<b>hi</b>\nline 2' })] }));
    const bodies = Array.from(el.querySelectorAll('.msg__body')).map(b => b.textContent);
    expect(bodies).toEqual(['<img src=x onerror=alert(1)>', '<b>hi</b>\nline 2']);
    expect(el.querySelector('.thread img')).toBeNull();
    expect(el.querySelector('.thread b')).toBeNull();
  });

  it('marks the patient messages read up to the last patient message id, then refreshes the count', async () => {
    await load(thread({ items: [message({ id: 1 }), message({ id: 2, sender: 'STAFF' }), message({ id: 3 })] }));
    const r = http.expectOne(`${api}/patients/5/messages/read`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ upToId: 3 });
    expect(refresh).not.toHaveBeenCalled();
    let readEvents = 0;
    component.read.subscribe(() => readEvents++);
    r.flush(null, { status: 204, statusText: 'No Content' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(readEvents).toBe(1);
  });

  it('does not mark anything read when every patient message is already read', async () => {
    await load(thread({ items: [message({ id: 1, readByStaffAt: '2026-10-14T16:00:00Z' })] }));
    http.expectNone(`${api}/patients/5/messages/read`);
    expect(refresh).not.toHaveBeenCalled();
  });

  describe('composer', () => {
    it('has a labelled textarea (2000 max), a counter, the hint and a disabled Send while empty', async () => {
      await load();
      expect(q('label').textContent).toBe('Message to patient');
      expect(q('textarea').getAttribute('maxlength')).toBe('2000');
      expect(q('.composer__hint').textContent).toContain('Plain text. The patient sees your name.');
      expect(q<HTMLButtonElement>('.msg-send').disabled).toBeTrue();
      await type('hello');
      expect(q('.composer__count').textContent).toBe('5 / 2000');
      expect(q<HTMLButtonElement>('.msg-send').disabled).toBeFalse();
    });

    it('Send posts the trimmed body, appends the bubble and clears the draft', async () => {
      await load();
      await type('  How is the wound?  ');
      q<HTMLButtonElement>('.msg-send').click();
      const r = http.expectOne(`${api}/patients/5/messages`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ body: 'How is the wound?' });
      await settle();
      expect(q('.msg-send').textContent).toContain('Sending…');
      expect(q<HTMLButtonElement>('.msg-send').disabled).toBeTrue();
      r.flush(message({ id: 7, sender: 'STAFF', senderName: 'Marie Nurse', body: 'How is the wound?' }), { status: 201, statusText: 'Created' });
      await settle();
      expect(el.querySelectorAll('.msg').length).toBe(1);
      expect(q('.msg').classList).toContain('msg--me');
      expect(q<HTMLTextAreaElement>('textarea').value).toBe('');
    });

    it('Ctrl+Enter and Cmd+Enter send; a plain Enter only inserts a newline', async () => {
      await load();
      await type('first');
      const ta = q<HTMLTextAreaElement>('textarea');
      const plain = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      ta.dispatchEvent(plain);
      http.expectNone(`${api}/patients/5/messages`);
      expect(plain.defaultPrevented).toBeFalse();
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true }));
      const r = http.expectOne(`${api}/patients/5/messages`);
      expect(r.request.body).toEqual({ body: 'first' });
      r.flush(message({ id: 7, sender: 'STAFF', body: 'first' }), { status: 201, statusText: 'Created' });
      await settle();
      await type('second');
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, cancelable: true }));
      http.expectOne(`${api}/patients/5/messages`).flush(message({ id: 8, sender: 'STAFF', body: 'second' }), { status: 201, statusText: 'Created' });
    });

    it('a closed thread disables the composer and explains why; history stays readable', async () => {
      await load(thread({ messagingOpen: false, messagingOpenUntil: null, items: [message({ id: 1, readByStaffAt: 'x' })] }));
      expect(q<HTMLTextAreaElement>('textarea').disabled).toBeTrue();
      expect(q<HTMLButtonElement>('.msg-send').disabled).toBeTrue();
      expect(q('.composer .banner--info').textContent).toContain('Messaging is closed: the patient has no active link. Create a follow-up or appointment to reopen it. History stays available.');
      expect(q('app-status-chip').textContent).toContain('Closed');
      expect(el.querySelectorAll('.msg').length).toBe(1);
    });

    it('an open thread shows the Open chip and no banner', async () => {
      await load();
      expect(q('app-status-chip').textContent).toContain('Open through');
      expect(el.querySelector('.composer .banner--info')).toBeNull();
    });

    it('a 409 MESSAGING_CLOSED on send closes the composer with the banner and keeps the draft', async () => {
      await load();
      await type('hello');
      q<HTMLButtonElement>('.msg-send').click();
      http.expectOne(`${api}/patients/5/messages`).flush(
        { status: 409, error: 'MESSAGING_CLOSED', message: 'Messaging is closed: the patient has no active link', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(q('.composer .banner--info').textContent).toContain('Messaging is closed');
      expect(q<HTMLTextAreaElement>('textarea').disabled).toBeTrue();
      expect(q('app-status-chip').textContent).toContain('Closed');
    });

    it('a 400 shows the plain-text message', async () => {
      await load();
      await type('hello');
      q<HTMLButtonElement>('.msg-send').click();
      http.expectOne(`${api}/patients/5/messages`).flush({ status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { body: 'must be plain text' } }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(q('.composer .banner--error').textContent).toContain('plain text');
      expect(q<HTMLTextAreaElement>('textarea').value).toBe('hello');
    });
  });

  it('Load earlier fetches the page before the oldest message and prepends it', async () => {
    await load(thread({ hasMore: true, items: [message({ id: 5, readByStaffAt: 'x' })] }));
    q<HTMLButtonElement>('.thread-earlier').click();
    threadReq('5').flush(thread({ hasMore: false, items: [message({ id: 3, body: 'older', readByStaffAt: 'x' })] }));
    await settle();
    expect(Array.from(el.querySelectorAll('.msg__body')).map(b => b.textContent)).toEqual(['older', 'Hello']);
    expect(el.querySelector('.thread-earlier')).toBeNull();
  });

  it('shows the empty state and a retry banner when loading fails', async () => {
    await load(thread());
    expect(el.textContent).toContain('No messages yet.');
    const again = TestBed.createComponent(MessageThreadComponent);
    again.componentInstance.patientId = 5;
    again.componentInstance.patientName = 'Jane Doe';
    again.componentInstance.ngOnChanges({ patientId: new SimpleChange(0, 5, true) });
    again.detectChanges();
    threadReq().flush('x', { status: 500, statusText: 'Server Error' });
    again.detectChanges();
    expect(again.nativeElement.textContent).toContain('Could not load messages');
  });

  describe('page variant', () => {
    it('shows the patient name linked to the file messages tab, fetching it when not known', async () => {
      await start('page', null);
      http.expectOne(`${api}/patients/5`).flush(JANE);
      threadReq().flush(thread());
      await settle();
      const link = q<HTMLAnchorElement>('.thread-who');
      expect(link.textContent).toBe('Jane Doe');
      expect(link.getAttribute('href')).toBe('/patients/5?tab=messages');
    });

    it('uses the name from the inbox without another request', async () => {
      await load(thread(), 'page');
      expect(q('.thread-who').textContent).toBe('Jane Doe');
      http.expectNone(`${api}/patients/5`);
    });

    it('polls every 30 s while visible, merging new messages by id', async () => {
      jasmine.clock().install();
      const visibility = spyOnProperty(document, 'visibilityState').and.returnValue('visible');
      await start('page');
      threadReq().flush(thread({ items: [message({ id: 1, readByStaffAt: 'x' })] }));
      await settle();
      jasmine.clock().tick(29_999);
      http.expectNone(r => r.url === `${api}/patients/5/messages`);
      jasmine.clock().tick(1);
      threadReq().flush(thread({ items: [message({ id: 1, readByStaffAt: 'x' }), message({ id: 2, body: 'new one' })] }));
      await settle();
      expect(el.querySelectorAll('.msg').length).toBe(2);
      http.expectOne(`${api}/patients/5/messages/read`).flush(null, { status: 204, statusText: 'No Content' });
      visibility.and.returnValue('hidden');
      jasmine.clock().tick(30_000);
      expect(http.match(r => r.url === `${api}/patients/5/messages`).length).toBe(0);
      fixture.destroy();
    });

    it('the embedded variant does not poll', async () => {
      jasmine.clock().install();
      spyOnProperty(document, 'visibilityState').and.returnValue('visible');
      await start('embedded');
      threadReq().flush(thread());
      jasmine.clock().tick(120_000);
      http.expectNone(r => r.url === `${api}/patients/5/messages`);
      fixture.destroy();
    });
  });
  describe('switching patient while a request is in flight', () => {
    const created = { status: 201, statusText: 'Created' };
    const noContent = { status: 204, statusText: 'No Content' };
    async function switchTo(id: number, t = thread({ items: [message({ id: 50, body: 'Other patient', readByStaffAt: 'x' })] })) {
      component.patientId = id;
      component.patientName = 'Other Person';
      component.ngOnChanges({ patientId: new SimpleChange(5, id, false) });
      await settle();
      http.expectOne(r => r.url === `${api}/patients/${id}/messages` && r.method === 'GET').flush(t);
      await settle();
    }
    const bodies = () => Array.from(el.querySelectorAll('.msg__body')).map(b => b.textContent);

    it('a message sent for patient A never shows up in patient B\'s thread, and B starts with a clean composer', async () => {
      await load();
      await type('for patient five');
      q<HTMLButtonElement>('.msg-send').click();
      const stale = http.expectOne(`${api}/patients/5/messages`);
      await switchTo(7);
      expect(component.sending).toBeFalse();
      expect(q<HTMLTextAreaElement>('textarea').value).toBe('');
      stale.flush(message({ id: 99, sender: 'STAFF', body: 'for patient five' }), created);
      await settle();
      expect(bodies()).toEqual(['Other patient']);
      expect(q<HTMLTextAreaElement>('textarea').value).toBe('');
    });

    it('a late reply to A does not clear B\'s draft or end B\'s own sending state', async () => {
      await load();
      await type('for five');
      q<HTMLButtonElement>('.msg-send').click();
      const stale = http.expectOne(`${api}/patients/5/messages`);
      await switchTo(7);
      await type('for seven');
      q<HTMLButtonElement>('.msg-send').click();
      const own = http.expectOne(`${api}/patients/7/messages`);
      expect(component.sending).toBeTrue();
      stale.flush(message({ id: 99, sender: 'STAFF', body: 'for five' }), created);
      await settle();
      expect(component.sending).toBeTrue();
      expect(component.draft).toBe('for seven');
      own.flush(message({ id: 100, sender: 'STAFF', body: 'for seven' }), created);
      await settle();
      expect(component.sending).toBeFalse();
      expect(bodies()).toEqual(['Other patient', 'for seven']);
    });

    it('a failed send for A shows no error in B', async () => {
      await load();
      await type('for five');
      q<HTMLButtonElement>('.msg-send').click();
      const stale = http.expectOne(`${api}/patients/5/messages`);
      await switchTo(7);
      stale.flush({ error: 'MESSAGING_CLOSED' }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(component.open).toBeTrue();
      expect(component.sendError).toBeNull();
      expect(el.querySelector('.composer .banner--info')).toBeNull();
    });

    it('older messages loaded for A are not prepended to B', async () => {
      await load(thread({ hasMore: true, items: [message({ id: 5, readByStaffAt: 'x' })] }));
      q<HTMLButtonElement>('.thread-earlier').click();
      const stale = threadReq('5');
      await switchTo(7);
      stale.flush(thread({ hasMore: false, items: [message({ id: 3, body: 'older of five', readByStaffAt: 'x' })] }));
      await settle();
      expect(bodies()).toEqual(['Other patient']);
    });

    it('a read receipt for A neither marks B\'s messages read nor refreshes the count', async () => {
      await load(thread({ items: [message({ id: 1 })] }));
      const stale = http.expectOne(`${api}/patients/5/messages/read`);
      let reads = 0;
      component.read.subscribe(() => reads++);
      await switchTo(7, thread({ items: [message({ id: 1, body: 'seven', readByStaffAt: 'x' })] }));
      stale.flush(null, noContent);
      expect(refresh).not.toHaveBeenCalled();
      expect(reads).toBe(0);
    });
  });
});

describe('MessageThreadComponent by permission', () => {
  const api = environment.apiUrl;

  async function mount(role: AccessRole) {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [MessageThreadComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions(role), { provide: MessageCountService, useValue: { refresh: () => undefined } }]
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MessageThreadComponent);
    const c = fixture.componentInstance;
    c.variant = 'embedded';
    c.patientId = 5;
    c.ngOnChanges({ patientId: new SimpleChange(0, 5, true) });
    fixture.detectChanges();
    http.expectOne(r => r.url === `${api}/patients/5/messages` && r.method === 'GET').flush(thread());
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    http.verify();
    return fixture.nativeElement as HTMLElement;
  }

  for (const role of ['ADMIN', 'PHYSICIAN', 'NURSE'] as AccessRole[]) {
    it(`${role} can write to the patient: composer and Send are shown`, async () => {
      const el = await mount(role);
      expect(el.querySelector('.composer')).not.toBeNull();
      expect(el.querySelector('.msg-send')).not.toBeNull();
    });
  }

  it('RECEPTION (no CLINICAL_WRITE) gets no composer', async () => {
    const el = await mount('RECEPTION');
    expect(el.querySelector('.composer')).toBeNull();
    expect(el.querySelector('.msg-send')).toBeNull();
  });
});
