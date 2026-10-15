import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { DocumentService } from './Document.service';

describe('DocumentService', () => {
  let http: HttpTestingController;
  let svc: DocumentService;
  const api = environment.apiUrl;
  const file = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(DocumentService);
  });
  afterEach(() => http.verify());

  it('lists the patient documents', () => {
    svc.list(5).subscribe();
    const r = http.expectOne(`${api}/patients/5/documents`);
    expect(r.request.method).toBe('GET');
    r.flush([]);
  });

  it('uploads FormData with file, category and an optional title, and sets no Content-Type', () => {
    svc.upload(5, file, 'LAB_RESULT', '  CBC  ').subscribe();
    const r = http.expectOne(`${api}/patients/5/documents`);
    expect(r.request.method).toBe('POST');
    const form = r.request.body as FormData;
    expect(form instanceof FormData).toBeTrue();
    expect((form.get('file') as File).name).toBe('report.pdf');
    expect(form.get('category')).toBe('LAB_RESULT');
    expect(form.get('title')).toBe('CBC');
    expect(r.request.headers.has('Content-Type')).toBeFalse();
    r.flush({});
  });

  it('omits an empty title', () => {
    svc.upload(5, file, 'OTHER').subscribe();
    svc.upload(5, file, 'OTHER', '   ').subscribe();
    for (const r of http.match(`${api}/patients/5/documents`)) {
      expect((r.request.body as FormData).has('title')).toBeFalse();
      r.flush({});
    }
  });

  it('content() asks for a blob', () => {
    svc.content(3).subscribe();
    const r = http.expectOne(`${api}/documents/3/content`);
    expect(r.request.method).toBe('GET');
    expect(r.request.responseType).toBe('blob');
    r.flush(new Blob(['x']));
  });

  it('remove() POSTs the reason to /delete', () => {
    svc.remove(3, 'duplicate').subscribe();
    const r = http.expectOne(`${api}/documents/3/delete`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ reason: 'duplicate' });
    r.flush(null, { status: 204, statusText: 'No Content' });
  });
});
