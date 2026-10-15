import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DocumentService } from '../../../Services/Document.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { DOCUMENT_CATEGORIES, DocumentCategory, PatientDocument } from '../../../models/document.model';
import { ACCEPT, MAX_BYTES, extensionOf, humanSize, typeLabel } from '../../../shared/files.util';
import { humanize } from '../../../shared/link.util';

export const TOO_BIG = 'File exceeds 10 MB';
export const BAD_TYPE = 'Only PDF, JPEG and PNG files are accepted';

@Component({
  selector: 'app-patient-documents',
  templateUrl: './patient-documents.component.html'
})
export class PatientDocumentsComponent implements OnInit, OnDestroy {
  @Input() patientId = 0;

  readonly accept = ACCEPT;
  readonly categories = DOCUMENT_CATEGORIES;
  readonly humanize = humanize;
  readonly humanSize = humanSize;
  readonly typeLabel = typeLabel;

  docs: PatientDocument[] = [];
  loading = true;
  loadError = false;
  actionError: string | null = null;

  drawer: 'upload' | 'view' | null = null;
  file: File | null = null;
  category: DocumentCategory = 'OTHER';
  title = '';
  uploading = false;
  errors: { file?: string; category?: string; title?: string; banner?: string } = {};

  viewDoc: PatientDocument | null = null;
  viewUrl: string | null = null;
  viewBusy = false;

  deleting: number | null = null;
  deleteBusy = false;

  @ViewChild('drawerEl') drawerEl?: ElementRef<HTMLElement>;
  private trigger: HTMLElement | null = null;

  constructor(private documents: DocumentService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.releaseView();
    document.body.classList.remove('drawer-open');
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this.documents.list(this.patientId).subscribe({
      next: d => {
        this.docs = d;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  get placeholder(): string {
    return this.file ? this.file.name.replace(/\.[^.]+$/, '') : '';
  }

  /* ---------- drawers ---------- */

  private open(kind: 'upload' | 'view', trigger: HTMLElement | null, focus = 'input, select, button'): void {
    this.trigger = trigger ?? (document.activeElement as HTMLElement | null);
    this.drawer = kind;
    document.body.classList.add('drawer-open');
    setTimeout(() => this.drawerEl?.nativeElement.querySelector<HTMLElement>(focus)?.focus());
  }

  openUpload(trigger: HTMLElement | null): void {
    this.file = null;
    this.category = 'OTHER';
    this.title = '';
    this.errors = {};
    this.open('upload', trigger, '#doc-file');
  }

  closeDrawer(): void {
    if (!this.drawer) {
      return;
    }
    this.drawer = null;
    document.body.classList.remove('drawer-open');
    this.releaseView();
    this.trigger?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.drawer) {
      return;
    }
    if (e.key === 'Escape') {
      this.closeDrawer();
    } else if (e.key === 'Tab' && this.drawerEl) {
      const els = Array.from(this.drawerEl.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!els.length) {
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ---------- upload ---------- */

  onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file = f;
    this.errors = { ...this.errors, file: f && f.size > MAX_BYTES ? TOO_BIG : undefined };
  }

  upload(): void {
    if (this.uploading) {
      return;
    }
    if (!this.file) {
      this.errors = { file: 'Choose a file' };
      return;
    }
    if (this.file.size > MAX_BYTES) {
      this.errors = { file: TOO_BIG };
      return;
    }
    if (this.file.size === 0) {
      this.errors = { file: 'The file is empty' };
      return;
    }
    this.uploading = true;
    this.errors = {};
    this.documents.upload(this.patientId, this.file, this.category, this.title).subscribe({
      next: d => {
        this.uploading = false;
        this.docs = [d, ...this.docs];
        this.closeDrawer();
      },
      error: err => {
        this.uploading = false;
        const api = apiErrorOf(err);
        if (err?.status === 413 || api?.error === 'PAYLOAD_TOO_LARGE') {
          this.errors = { file: TOO_BIG };
        } else if (err?.status === 415 || api?.error === 'UNSUPPORTED_MEDIA_TYPE') {
          this.errors = { file: BAD_TYPE };
        } else if (api && Object.keys(api.fieldErrors).length) {
          this.errors = { file: api.fieldErrors['file'], category: api.fieldErrors['category'], title: api.fieldErrors['title'] };
        } else {
          this.errors = { banner: 'Could not upload the document.' };
        }
      }
    });
  }

  /* ---------- view / download / delete ---------- */

  view(d: PatientDocument, trigger: HTMLElement | null): void {
    this.actionError = null;
    this.viewBusy = true;
    this.documents.content(d.id).subscribe({
      next: blob => {
        this.viewBusy = false;
        if (d.contentType === 'application/pdf') {
          // the server's content type is not trusted to render inline: pin it to PDF
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          const url = URL.createObjectURL(blob);
          this.viewDoc = d;
          this.viewUrl = url;
          this.open('view', trigger);
        }
      },
      error: () => {
        this.viewBusy = false;
        this.actionError = 'Could not open the document.';
      }
    });
  }

  private releaseView(): void {
    if (this.viewUrl) {
      URL.revokeObjectURL(this.viewUrl);
    }
    this.viewUrl = null;
    this.viewDoc = null;
  }

  download(d: PatientDocument): void {
    this.actionError = null;
    this.documents.content(d.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${d.title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'document'}.${extensionOf(d.contentType)}`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => (this.actionError = 'Could not download the document.')
    });
  }

  onMenu(d: PatientDocument, key: string): void {
    if (key === 'delete') {
      this.deleting = d.id;
    }
  }

  confirmDelete(d: PatientDocument, reason: string): void {
    this.deleteBusy = true;
    this.documents.remove(d.id, reason).subscribe({
      next: () => {
        this.deleteBusy = false;
        this.deleting = null;
        this.docs = this.docs.filter(x => x.id !== d.id);
      },
      error: () => {
        this.deleteBusy = false;
        this.actionError = 'Could not delete the document.';
      }
    });
  }
}
