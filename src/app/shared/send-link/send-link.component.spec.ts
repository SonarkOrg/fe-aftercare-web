import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { NotificationItem } from '../../models/notification.model';
import { contactPrefs, notification } from '../../testing/fixtures';
import { SendLinkComponent } from './send-link.component';

@Component({
  template: `<app-send-link [kind]="kind" [targetId]="11" [patientId]="5" (sent)="sentEvents.push($event)"></app-send-link>`,
  standalone: true,
  imports: [SendLinkComponent]
})
class HostComponent {
  kind: 'follow-up' | 'appointment' = 'follow-up';
  sentEvents: NotificationItem[] = [];
}

describe('SendLinkComponent', () => {
  const api = environment.apiUrl;
  let fixture: ComponentFixture<HostComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent, HttpClientTestingModule, RouterTestingModule] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const btn = () => el.querySelector<HTMLButtonElement>('.send-link__btn')!;
  const items = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.send-link__item'));
  const labels = () => items().map(i => i.textContent!.trim());
  const openMenu = (prefs = contactPrefs()) => {
    btn().click();
    http.expectOne(`${api}/patients/5/contact-preferences`).flush(prefs);
    fixture.detectChanges();
  };
  const fail = (url: string, error: string, status: number, message = 'm') => {
    items()[0].click();
    http.expectOne(url).flush({ status, error, message, fieldErrors: {} }, { status, statusText: 'err' });
    fixture.detectChanges();
  };
  const errorText = () => el.querySelector('.send-link__err')!.textContent!.replace(/\s+/g, ' ').trim();

  it('loads the contact preferences lazily, and again on every opening', () => {
    http.expectNone(`${api}/patients/5/contact-preferences`);
    expect(btn().getAttribute('aria-haspopup')).toBe('menu');
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    openMenu(contactPrefs({ preferredChannel: 'EMAIL', emailAvailable: true, smsAvailable: true }));
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    expect(labels()[0]).toBe('By email (preferred)');
    btn().click(); // close
    openMenu(contactPrefs({ preferredChannel: 'SMS', emailAvailable: true, smsAvailable: true })); // reopen: reloaded
    expect(labels()[0]).toBe('By SMS (preferred)');
  });

  it('keeps the same option objects between change detections and moves focus with the arrow keys', () => {
    document.body.appendChild(el);
    openMenu(contactPrefs({ preferredChannel: 'EMAIL', emailAvailable: true, smsAvailable: true }));
    const cmp = fixture.debugElement.query(By.directive(SendLinkComponent)).componentInstance as SendLinkComponent;
    const first = cmp.options;
    fixture.detectChanges();
    expect(cmp.options).toBe(first);
    items()[0].focus();
    const menu = el.querySelector('.send-link__menu')!;
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items()[1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(items()[0]);
    el.remove();
  });

  it('offers the preferred channel and the other one when it is available', () => {
    openMenu(contactPrefs({ preferredChannel: 'EMAIL', emailAvailable: true, smsAvailable: true }));
    expect(labels()).toEqual(['By email (preferred)', 'By SMS']);
  });

  it('prefers SMS when the patient does, and leaves out an unavailable channel', () => {
    openMenu(contactPrefs({ preferredChannel: 'SMS', smsAvailable: true, emailAvailable: false }));
    expect(labels()).toEqual(['By SMS (preferred)']);
  });

  it('sends { channel: null } for the preferred channel to the follow-up endpoint and shows the queued banner', () => {
    openMenu();
    items()[0].click();
    const r = http.expectOne(`${api}/follow-ups/11/send-link`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ channel: null });
    r.flush(notification({ status: 'PENDING', recipientMasked: 'j•••@example.com', sentAt: null }), { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(el.querySelector('.send-link__ok')!.textContent).toContain('Link queued for email to j•••@example.com.');
    expect(fixture.componentInstance.sentEvents.length).toBe(1);
    expect(el.querySelector('.send-link__menu')).toBeNull();
  });

  it('sends the explicit channel when the other one is chosen, and names SMS in the banner', () => {
    openMenu();
    items()[1].click();
    const r = http.expectOne(`${api}/follow-ups/11/send-link`);
    expect(r.request.body).toEqual({ channel: 'SMS' });
    r.flush(notification({ channel: 'SMS', recipientMasked: '•••-•••-0100' }), { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(el.querySelector('.send-link__ok')!.textContent).toContain('Link queued for SMS to •••-•••-0100.');
  });

  it('says "the patient" while the masked recipient is not known yet', () => {
    openMenu();
    items()[0].click();
    http.expectOne(`${api}/follow-ups/11/send-link`).flush(notification({ status: 'PENDING', recipientMasked: null }), { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(el.querySelector('.send-link__ok')!.textContent).toContain('Link queued for email to the patient.');
  });

  it('uses the appointment endpoint for kind="appointment"', () => {
    fixture.componentInstance.kind = 'appointment';
    fixture.detectChanges();
    openMenu();
    items()[0].click();
    const r = http.expectOne(`${api}/appointments/11/send-link`);
    expect(r.request.body).toEqual({ channel: null });
    r.flush(notification({ template: 'APPOINTMENT_LINK', appointmentId: 11, followUpId: null }), { status: 202, statusText: 'Accepted' });
  });

  describe('errors', () => {
    const url = `${api}/follow-ups/11/send-link`;

    it('NO_CONSENT points to the Contacts tab', () => {
      openMenu();
      fail(url, 'NO_CONSENT', 409);
      expect(errorText()).toContain("The patient's consent to notifications isn't recorded. Update it in Contacts.");
      const link = el.querySelector<HTMLAnchorElement>('.send-link__err a')!;
      expect(link.getAttribute('href')).toBe('/patients/5?tab=contacts');
    });

    it('CHANNEL_DISABLED', () => {
      openMenu();
      fail(url, 'CHANNEL_DISABLED', 409);
      expect(errorText()).toBe('▲This channel is disabled in Settings.');
      expect(el.querySelector('.send-link__err a')).toBeNull();
    });

    it('NO_RECIPIENT', () => {
      openMenu();
      fail(url, 'NO_RECIPIENT', 409);
      expect(errorText()).toBe('▲The patient has no valid address for this channel.');
    });

    it('LINK_UNAVAILABLE', () => {
      openMenu();
      fail(url, 'LINK_UNAVAILABLE', 409);
      expect(errorText()).toBe('▲Generate a new link first, then send it.');
    });

    it('NOTIFICATION_LIMIT shows the server message', () => {
      openMenu();
      fail(url, 'NOTIFICATION_LIMIT', 429, 'Too many notifications for this patient; try again later');
      expect(errorText()).toBe('▲Too many notifications for this patient; try again later');
    });

    it('FORBIDDEN and unknown failures use the shared error text', () => {
      openMenu();
      fail(url, 'FORBIDDEN', 403);
      expect(errorText()).toBe("▲You don't have permission for this action.");
      openMenu();
      items()[0].click();
      http.expectOne(url).flush({ status: 409, error: 'INVALID_STATE', message: 'Follow-up is not active', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(errorText()).toBe('▲Follow-up is not active');
    });

    it('a failed preferences load shows its error and closes the menu', () => {
      btn().click();
      http.expectOne(`${api}/patients/5/contact-preferences`).flush('x', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el.querySelector('.send-link__menu')).toBeNull();
      expect(errorText()).toContain('Could not load the contact preferences.');
    });

    it('a new attempt clears the previous banner', () => {
      openMenu();
      fail(url, 'NO_RECIPIENT', 409);
      btn().click();
      http.expectOne(`${api}/patients/5/contact-preferences`).flush(contactPrefs());
      fixture.detectChanges();
      expect(el.querySelector('.send-link__err')).toBeNull();
    });
  });

  it('Esc closes the menu and returns focus to the button', () => {
    document.body.appendChild(el);
    openMenu();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.send-link__menu')).toBeNull();
    expect(document.activeElement).toBe(btn());
    el.remove();
  });
});
