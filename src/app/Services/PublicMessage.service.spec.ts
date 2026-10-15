import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { PublicMessageService } from './PublicMessage.service';

describe('PublicMessageService', () => {
  let http: HttpTestingController;
  let svc: PublicMessageService;
  const base = `${environment.apiUrl}/public/q/abc%2F1/messages`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(PublicMessageService);
  });
  afterEach(() => http.verify());

  it('encodes the code in the path and sends before only for older pages', () => {
    svc.thread('abc/1').subscribe();
    let r = http.expectOne(x => x.url === base);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.has('before')).toBeFalse();
    r.flush({});
    svc.thread('abc/1', 7).subscribe();
    r = http.expectOne(x => x.url === base);
    expect(r.request.params.get('before')).toBe('7');
    r.flush({});
  });

  it('send and markRead', () => {
    svc.send('abc/1', 'bonjour').subscribe();
    let r = http.expectOne(base);
    expect([r.request.method, r.request.body]).toEqual(['POST', { body: 'bonjour' }]);
    r.flush({});
    svc.markRead('abc/1', 4).subscribe();
    r = http.expectOne(`${base}/read`);
    expect([r.request.method, r.request.body]).toEqual(['POST', { upToId: 4 }]);
    r.flush(null, { status: 204, statusText: 'No Content' });
  });
});
