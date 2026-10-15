import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { MessageService } from './Message.service';

describe('MessageService', () => {
  let http: HttpTestingController;
  let svc: MessageService;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(MessageService);
  });
  afterEach(() => http.verify());

  it('inbox and unread count', () => {
    svc.inbox().subscribe();
    http.expectOne(`${api}/messages/inbox`).flush([]);
    svc.unreadCount().subscribe();
    http.expectOne(`${api}/messages/unread-count`).flush({ unreadMessages: 0, conversations: 0 });
  });

  it('thread: the newest page has no before; older pages send it', () => {
    svc.thread(5).subscribe();
    let r = http.expectOne(x => x.url === `${api}/patients/5/messages`);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.has('before')).toBeFalse();
    r.flush({});
    svc.thread(5, 12).subscribe();
    r = http.expectOne(x => x.url === `${api}/patients/5/messages`);
    expect(r.request.params.get('before')).toBe('12');
    r.flush({});
  });

  it('send and markRead', () => {
    svc.send(5, 'hello').subscribe();
    let r = http.expectOne(`${api}/patients/5/messages`);
    expect([r.request.method, r.request.body]).toEqual(['POST', { body: 'hello' }]);
    r.flush({});
    svc.markRead(5, 9).subscribe();
    r = http.expectOne(`${api}/patients/5/messages/read`);
    expect([r.request.method, r.request.body]).toEqual(['POST', { upToId: 9 }]);
    r.flush(null, { status: 204, statusText: 'No Content' });
  });
});
