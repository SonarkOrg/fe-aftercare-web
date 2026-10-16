import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { contactPrefs, notification } from '../testing/fixtures';
import { NotificationService } from './Notification.service';

describe('NotificationService', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let svc: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(NotificationService);
  });
  afterEach(() => http.verify());

  it('reads and saves the contact preferences', () => {
    svc.preferences(5).subscribe();
    let r = http.expectOne(`${api}/patients/5/contact-preferences`);
    expect(r.request.method).toBe('GET');
    r.flush(contactPrefs());
    const body = { preferredChannel: 'SMS' as const, language: null, contactConsent: 'GRANTED' as const };
    svc.savePreferences(5, body).subscribe();
    r = http.expectOne(`${api}/patients/5/contact-preferences`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual(body);
    r.flush(contactPrefs(body));
  });

  it('lists the notifications with page and size (default 0 / 20)', () => {
    svc.list(5).subscribe();
    let r = http.expectOne(x => x.url === `${api}/patients/5/notifications`);
    expect([r.request.params.get('page'), r.request.params.get('size')]).toEqual(['0', '20']);
    r.flush({ items: [notification()], page: 0, size: 20, hasMore: false });
    svc.list(5, 2, 10).subscribe();
    r = http.expectOne(x => x.url === `${api}/patients/5/notifications`);
    expect([r.request.params.get('page'), r.request.params.get('size')]).toEqual(['2', '10']);
    r.flush({ items: [], page: 2, size: 10, hasMore: false });
  });

  it('POSTs { channel } to the follow-up and appointment send-link endpoints (null = preferred)', () => {
    svc.sendFollowUpLink(11, null).subscribe();
    let r = http.expectOne(`${api}/follow-ups/11/send-link`);
    expect([r.request.method, r.request.body]).toEqual(['POST', { channel: null }]);
    r.flush(notification(), { status: 202, statusText: 'Accepted' });
    svc.sendAppointmentLink(4, 'SMS').subscribe();
    r = http.expectOne(`${api}/appointments/4/send-link`);
    expect([r.request.method, r.request.body]).toEqual(['POST', { channel: 'SMS' }]);
    r.flush(notification({ template: 'APPOINTMENT_LINK' }), { status: 202, statusText: 'Accepted' });
  });
});
