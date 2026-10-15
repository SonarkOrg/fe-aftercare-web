import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { TimelineService } from './Timeline.service';

describe('TimelineService', () => {
  let http: HttpTestingController;
  let svc: TimelineService;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(TimelineService);
  });
  afterEach(() => http.verify());

  it('repeats the category param and sends page and size', () => {
    svc.timeline(5, ['NOTE', 'ALERT'], 2, 30).subscribe();
    const r = http.expectOne(x => x.url === `${api}/patients/5/timeline`);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.getAll('category')).toEqual(['NOTE', 'ALERT']);
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.get('size')).toBe('30');
    r.flush({ items: [], page: 2, size: 30, hasMore: false });
  });

  it('sends no category for "all"', () => {
    svc.timeline(5, []).subscribe();
    const r = http.expectOne(x => x.url === `${api}/patients/5/timeline`);
    expect(r.request.params.has('category')).toBeFalse();
    expect(r.request.params.get('page')).toBe('0');
    expect(r.request.params.get('size')).toBe('30');
    r.flush({ items: [], page: 0, size: 30, hasMore: false });
  });

  it('notes: add, edit, delete', () => {
    svc.addNote(5, { body: 'b', notedAt: null }).subscribe();
    let r = http.expectOne(`${api}/patients/5/notes`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ body: 'b', notedAt: null });
    r.flush({});
    svc.editNote(30, 'new').subscribe();
    r = http.expectOne(`${api}/notes/30`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ body: 'new' });
    r.flush({});
    svc.deleteNote(30, 'wrong patient').subscribe();
    r = http.expectOne(`${api}/notes/30/delete`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ reason: 'wrong patient' });
    r.flush({});
  });
});
