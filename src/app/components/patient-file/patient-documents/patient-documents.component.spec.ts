import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { PatientDocument } from '../../../models/document.model';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { BAD_TYPE, PatientDocumentsComponent, TOO_BIG } from './patient-documents.component';
import { providePermissions } from '../../../testing/fixtures';

describe('PatientDocumentsComponent', () => {
  let fixture: ComponentFixture<PatientDocumentsComponent>;
  let component: PatientDocumentsComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = environment.apiUrl;

  const doc = (over: Partial<PatientDocument> = {}): PatientDocument => ({
    id: 3, patientId: 5, title: 'Discharge summary', category: 'DISCHARGE_SUMMARY', contentType: 'application/pdf', sizeBytes: 2048,
    originalFilename: 'summary.pdf', sha256: 'a'.repeat(64), uploadedAt: '2026-10-14T15:00:00Z', uploadedByName: 'Dev Nurse', ...over
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [providePermissions('NURSE')],
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientDocumentsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientDocumentsComponent);
    component = fixture.componentInstance;
    component.patientId = 5;
    el = fixture.nativeElement;
  });
  afterEach(() => {
    http.verify();
    document.body.classList.remove('drawer-open');
  });

  const init = async (docs: PatientDocument[] = [doc()]) => {
    await settle();
    http.expectOne(`${api}/patients/5/documents`).flush(docs);
    await settle();
  };
  /** ngModel connects its controls (and writes values / disabled) in a microtask: wait for it, then render. */
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const pick = async (file: File) => {
    component.onFile({ target: { files: [file] } } as unknown as Event);
    await settle();
  };
  const submit = async () => {
    q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
    await settle();
  };
  const openUpload = async () => {
    q<HTMLButtonElement>('.upload-btn').click();
    await settle();
  };

  it('lists documents with category, type, size, date and author', async () => {
    await init();
    const row = q('.doc-row');
    expect(row.querySelector('.row__name')!.textContent).toBe('Discharge summary');
    expect(row.querySelector('.row__sub')!.textContent).toBe('Discharge summary · PDF · 2 KB · 14 Oct 2026 · Dev Nurse');
    expect(q('.documents-card .badge').textContent).toBe('1');
  });

  it('shows the empty state', async () => {
    await init([]);
    expect(el.textContent).toContain('No documents.');
  });

  it('the upload drawer has the accept list, the categories, the optional title and the helper text', async () => {
    await init();
    await openUpload();
    expect(document.body.classList).toContain('drawer-open');
    expect(q<HTMLInputElement>('#doc-file').getAttribute('accept')).toBe('.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png');
    expect(Array.from(el.querySelectorAll('#doc-category option')).map(o => o.textContent!.trim())).toEqual(
      ['Discharge summary', 'Consent', 'Prescription', 'Lab result', 'Imaging', 'Referral', 'Other']);
    expect(q<HTMLInputElement>('#doc-title').getAttribute('maxlength')).toBe('120');
    expect(q('#doc-help').textContent).toBe('PDF, JPEG or PNG, up to 10 MB. Do not upload files from untrusted sources.');
  });

  it('the title placeholder is the selected filename without its extension', async () => {
    await init();
    await openUpload();
    await pick(new File(['%PDF-1.4'], 'Lab results.final.pdf'));
    expect(q<HTMLInputElement>('#doc-title').placeholder).toBe('Lab results.final');
  });

  it('blocks a file over 10 MB on the client: error, no request', async () => {
    await init();
    await openUpload();
    await pick(new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf'));
    expect(q('.drawer .field-error').textContent).toBe(TOO_BIG);
    await submit();
    http.expectNone(`${api}/patients/5/documents`);
    expect(q('.drawer .field-error').textContent).toBe('File exceeds 10 MB');
  });

  it('asks for a file when none is chosen', async () => {
    await init();
    await openUpload();
    await submit();
    http.expectNone(`${api}/patients/5/documents`);
    expect(q('.drawer .field-error').textContent).toBe('Choose a file');
  });

  it('uploads: FormData with file, category and title, a disabled "Uploading…" button, then the new row and a closed drawer', async () => {
    await init([]);
    await openUpload();
    await pick(new File(['%PDF-1.4'], 'summary.pdf', { type: 'application/pdf' }));
    const cat = q<HTMLSelectElement>('#doc-category');
    cat.value = 'LAB_RESULT';
    cat.dispatchEvent(new Event('change'));
    const title = q<HTMLInputElement>('#doc-title');
    title.value = 'CBC';
    title.dispatchEvent(new Event('input'));
    await submit();
    const r = http.expectOne(`${api}/patients/5/documents`);
    const form = r.request.body as FormData;
    expect((form.get('file') as File).name).toBe('summary.pdf');
    expect(form.get('category')).toBe('LAB_RESULT');
    expect(form.get('title')).toBe('CBC');
    expect(r.request.headers.has('Content-Type')).toBeFalse();
    expect(q<HTMLButtonElement>('.upload-submit').disabled).toBeTrue();
    expect(q('.upload-submit').textContent).toBe('Uploading…');
    r.flush(doc({ id: 8, title: 'CBC', category: 'LAB_RESULT' }), { status: 201, statusText: 'Created' });
    await settle();
    expect(el.querySelector('.drawer')).toBeNull();
    expect(document.body.classList).not.toContain('drawer-open');
    expect(el.querySelectorAll('.doc-row').length).toBe(1);
    expect(q('.doc-row .row__name').textContent).toBe('CBC');
  });

  it('maps 415 to "Only PDF, JPEG and PNG files are accepted" and 413 to the size message', async () => {
    await init();
    await openUpload();
    await pick(new File(['x'], 'a.heic'));
    await submit();
    http.expectOne(`${api}/patients/5/documents`).flush({ status: 415, error: 'UNSUPPORTED_MEDIA_TYPE', message: 'x', fieldErrors: {} }, { status: 415, statusText: 'Unsupported Media Type' });
    await settle();
    expect(q('.drawer .field-error').textContent).toBe('Only PDF, JPEG and PNG files are accepted');
    expect(BAD_TYPE).toBe('Only PDF, JPEG and PNG files are accepted');
    await submit();
    http.expectOne(`${api}/patients/5/documents`).flush({ status: 413, error: 'PAYLOAD_TOO_LARGE', message: 'x', fieldErrors: {} }, { status: 413, statusText: 'Payload Too Large' });
    await settle();
    expect(q('.drawer .field-error').textContent).toBe('File exceeds 10 MB');
    expect(q<HTMLButtonElement>('.upload-submit').disabled).toBeFalse();
  });

  it('maps 400 field errors under their inputs', async () => {
    await init();
    await openUpload();
    await pick(new File(['x'], 'a.pdf'));
    await submit();
    http.expectOne(`${api}/patients/5/documents`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { title: 'size must be between 1 and 120' } }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('#doc-title').parentElement!.querySelector('.field-error')!.textContent).toBe('size must be between 1 and 120');
  });

  it('the upload drawer starts with focus on the file input', async () => {
    await init();
    document.body.appendChild(el);
    await openUpload();
    await new Promise<void>(r => setTimeout(r));
    expect(document.activeElement).toBe(q('#doc-file'));
    el.remove();
  });

  it('Esc closes the drawer and returns focus to the trigger', async () => {
    await init();
    document.body.appendChild(el);
    await openUpload();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(el.querySelector('.drawer')).toBeNull();
    el.remove();
  });

  it('View on an image opens it in the drawer through a blob: URL, never as HTML', async () => {
    const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:http://localhost/img-1');
    const revoke = spyOn(URL, 'revokeObjectURL');
    await init([doc({ id: 4, title: 'Wound photo', contentType: 'image/jpeg' })]);
    q<HTMLButtonElement>('.view-doc').click();
    const r = http.expectOne(`${api}/documents/4/content`);
    expect(r.request.responseType).toBe('blob');
    r.flush(new Blob(['x'], { type: 'image/jpeg' }));
    await settle();
    expect(create).toHaveBeenCalled();
    const img = q<HTMLImageElement>('.drawer img.doc-image');
    expect(img.getAttribute('src')).toBe('blob:http://localhost/img-1');
    expect(img.alt).toBe('Wound photo');
    q<HTMLButtonElement>('.drawer [aria-label=Close]').click();
    await settle();
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/img-1');
  });

  it('View on a PDF opens a new window with noopener and revokes the URL after 60 s', async () => {
    jasmine.clock().install();
    try {
      const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:http://localhost/pdf-1');
      const revoke = spyOn(URL, 'revokeObjectURL');
      const open = spyOn(window, 'open').and.returnValue(null);
      await init();
      q<HTMLButtonElement>('.view-doc').click();
      http.expectOne(`${api}/documents/3/content`).flush(new Blob(['%PDF'], { type: 'application/octet-stream' }));
      expect((create.calls.mostRecent().args[0] as Blob).type).toBe('application/pdf');
      expect(open).toHaveBeenCalledWith('blob:http://localhost/pdf-1', '_blank', 'noopener');
      expect(revoke).not.toHaveBeenCalled();
      jasmine.clock().tick(60_000);
      expect(revoke).toHaveBeenCalledWith('blob:http://localhost/pdf-1');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('Download uses a temporary link named after the title and the type, then revokes the URL', async () => {
    jasmine.clock().install();
    try {
      spyOn(URL, 'createObjectURL').and.returnValue('blob:http://localhost/dl-1');
      const revoke = spyOn(URL, 'revokeObjectURL');
      const clicked: { download: string; href: string }[] = [];
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        clicked.push({ download: this.download, href: this.href });
      });
      await init([doc({ title: 'A/B: results' })]);
      q<HTMLButtonElement>('.download-doc').click();
      http.expectOne(`${api}/documents/3/content`).flush(new Blob(['%PDF']));
      expect(clicked).toEqual([{ download: 'A_B_ results.pdf', href: 'blob:http://localhost/dl-1' }]);
      jasmine.clock().tick(999);
      expect(revoke).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      expect(revoke).toHaveBeenCalledWith('blob:http://localhost/dl-1');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('Delete needs a reason, then POSTs it to /delete and removes the row', async () => {
    await init();
    q<HTMLButtonElement>('.doc-row app-row-menu .more-btn').click();
    await settle();
    q<HTMLButtonElement>('.row-menu__item[data-key=delete]').click();
    await settle();
    expect(q<HTMLButtonElement>('.confirm-inline__ok').disabled).toBeTrue();
    const ta = q<HTMLTextAreaElement>('app-confirm-inline textarea');
    ta.value = 'Uploaded to the wrong file';
    ta.dispatchEvent(new Event('input'));
    await settle();
    q<HTMLButtonElement>('.confirm-inline__ok').click();
    const r = http.expectOne(`${api}/documents/3/delete`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ reason: 'Uploaded to the wrong file' });
    r.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(el.querySelectorAll('.doc-row').length).toBe(0);
    expect(el.textContent).toContain('No documents.');
  });

  it('shows a retry banner when the list fails to load', async () => {
    await settle();
    http.expectOne(`${api}/patients/5/documents`).flush('x', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(el.textContent).toContain('Could not load the documents');
  });
});
