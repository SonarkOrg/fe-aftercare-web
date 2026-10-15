import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { MessageCountService } from './MessageCount.service';

describe('MessageCountService', () => {
  let http: HttpTestingController;
  let svc: MessageCountService;
  const url = `${environment.apiUrl}/messages/unread-count`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(MessageCountService);
  });
  afterEach(() => {
    svc.stop();
    http.verify();
  });

  it('starts at 0 and refresh() sets the unread message count', () => {
    expect(svc.unread$.value).toBe(0);
    svc.refresh();
    http.expectOne(url).flush({ unreadMessages: 4, conversations: 2 });
    expect(svc.unread$.value).toBe(4);
  });

  it('report() sets the count without a request (the inbox total, shown in the top bar)', () => {
    svc.report(5);
    expect(svc.unread$.value).toBe(5);
    http.expectNone(url);
  });

  it('keeps the previous value on error', () => {
    svc.refresh();
    http.expectOne(url).flush({ unreadMessages: 2, conversations: 1 });
    svc.refresh();
    http.expectOne(url).flush('x', { status: 500, statusText: 'Server Error' });
    expect(svc.unread$.value).toBe(2);
  });

  it('polls every 60 s while the tab is visible and skips while hidden', fakeAsync(() => {
    const visibility = spyOnProperty(document, 'visibilityState').and.returnValue('visible');
    svc.start();
    svc.start(); // idempotent
    tick(59_000);
    http.expectNone(url);
    tick(1_000);
    http.expectOne(url).flush({ unreadMessages: 1, conversations: 1 });
    visibility.and.returnValue('hidden');
    tick(60_000);
    http.expectNone(url);
    visibility.and.returnValue('visible');
    tick(60_000);
    http.expectOne(url).flush({ unreadMessages: 3, conversations: 1 });
    expect(svc.unread$.value).toBe(3);
    svc.stop();
    tick(120_000);
    http.expectNone(url);
  }));
});
