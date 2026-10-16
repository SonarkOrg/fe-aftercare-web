import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Inject, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { NotificationService } from '../../../Services/Notification.service';
import { PatientFileService } from '../../../Services/PatientFile.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { I18nService } from '../../../i18n/i18n.service';
import { ContactConsent, ContactPreferences } from '../../../models/notification.model';
import { Patient } from '../../../models/patient.model';
import { addDays, businessToday } from '../../../shared/link.util';

export interface PatientEditResult {
  patient: Patient;
  /** Fresh preferences read after the save (null when the caller may not read them). */
  prefs: ContactPreferences | null;
  /** Email or phone changed. */
  contactChanged: boolean;
}

interface Field { key: string; id: string; max?: number }

const FIELDS: Field[] = [
  { key: 'firstName', id: 'edit-firstName', max: 255 },
  { key: 'lastName', id: 'edit-lastName', max: 255 },
  { key: 'email', id: 'edit-email', max: 255 },
  { key: 'phone', id: 'edit-phone', max: 255 },
  { key: 'gender', id: 'edit-gender' },
  { key: 'dateOfBirth', id: 'edit-dob' },
  { key: 'address.city', id: 'edit-city', max: 255 },
  { key: 'address.state', id: 'edit-state', max: 255 },
  { key: 'address.zip', id: 'edit-zip', max: 255 }
];

const MIN_DOB = '1900-01-01';
// the server's @Email is lenient: something@something
const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Drawer to edit a patient's demographics and contact details. The server replaces the whole record, so the full patient is sent. */
@Component({
  selector: 'app-patient-edit',
  templateUrl: './patient-edit.component.html'
})
export class PatientEditComponent implements OnInit, OnDestroy {
  @Input() patient!: Patient;
  /** The element that opened the drawer: gets the focus back on close. */
  @Input() trigger: HTMLElement | null = null;
  @Output() saved = new EventEmitter<PatientEditResult>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('drawerEl') drawerEl?: ElementRef<HTMLElement>;

  form = { firstName: '', lastName: '', email: '', phone: '', gender: 'male', dateOfBirth: '', city: '', state: '', zip: '' };
  consent: ContactConsent | null = null;
  submitted = false;
  saving = false;
  banner: string | null = null;
  serverErrors: Record<string, string> = {};
  /** Latest selectable date of birth: yesterday in the clinic's time zone. */
  readonly dobMax = addDays(businessToday(), -1);

  constructor(
    private files: PatientFileService,
    private notifications: NotificationService,
    private apiErrors: ApiErrorsService,
    private i18n: I18nService,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  ngOnInit(): void {
    const p = this.patient;
    this.form = {
      firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, gender: p.gender || 'male',
      dateOfBirth: p.dateOfBirth ?? '', city: p.address?.city ?? '', state: p.address?.state ?? '', zip: p.address?.zip ?? ''
    };
    this.doc.body.classList.add('drawer-open');
    // the consent state decides whether the reset notice applies; without PATIENT_READ it just stays out
    this.notifications.preferences(p.id!).subscribe({ next: prefs => (this.consent = prefs.contactConsent), error: () => { /* no notice */ } });
    setTimeout(() => (this.doc.getElementById('edit-firstName') as HTMLElement | null)?.focus());
  }

  ngOnDestroy(): void {
    this.doc.body.classList.remove('drawer-open');
  }

  /* ---------- validation (mirrors PatientDTO) ---------- */

  private value(key: string): string {
    const f = this.form;
    switch (key) {
      case 'address.city': return f.city.trim();
      case 'address.state': return f.state.trim();
      case 'address.zip': return f.zip.trim();
      case 'firstName': case 'lastName': case 'email': case 'phone': case 'gender': case 'dateOfBirth':
        return String(f[key]).trim();
    }
    return '';
  }

  private clientError(field: Field): string | null {
    const v = this.value(field.key);
    if (field.key === 'dateOfBirth') {
      if (!v) {
        return null; // optional
      }
      if (v > this.dobMax) {
        return this.i18n.t('pf.edit.err.dobFuture');
      }
      return v < MIN_DOB ? this.i18n.t('pf.edit.err.dobOld') : null;
    }
    if (!v) {
      return this.i18n.t('pf.edit.err.required');
    }
    if (field.max && v.length > field.max) {
      return this.i18n.t('pf.edit.err.max', { max: field.max });
    }
    if (field.key === 'email' && !EMAIL.test(v)) {
      return this.i18n.t('pf.edit.err.email');
    }
    return null;
  }

  /** The message shown under a field: the local one after a submit attempt, else what the server answered. */
  error(key: string): string | null {
    const field = FIELDS.find(f => f.key === key)!;
    return (this.submitted ? this.clientError(field) : null) ?? this.serverErrors[key] ?? null;
  }

  /** Editing a field drops the server's message about it. */
  touch(key: string): void {
    if (this.serverErrors[key]) {
      const { [key]: _gone, ...rest } = this.serverErrors;
      this.serverErrors = rest;
    }
  }

  /* ---------- consent notice ---------- */

  get contactChanged(): boolean {
    return this.value('email') !== this.patient.email || this.value('phone') !== this.patient.phone;
  }

  get showConsentNotice(): boolean {
    return this.consent === 'GRANTED' && this.contactChanged;
  }

  /* ---------- save ---------- */

  save(): void {
    if (this.saving) {
      return;
    }
    this.submitted = true;
    this.banner = null;
    this.serverErrors = {};
    const bad = FIELDS.find(f => this.clientError(f));
    if (bad) {
      this.doc.getElementById(bad.id)?.focus();
      return;
    }
    const f = this.form;
    const contactChanged = this.contactChanged;
    // full replace on the server: everything not sent is cleared, so send the whole patient with only the edits applied
    const body: Patient = {
      id: this.patient.id,
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(), gender: f.gender,
      dateOfBirth: f.dateOfBirth.trim() || null,
      address: { city: f.city.trim(), state: f.state.trim(), zip: f.zip.trim() }
    };
    this.saving = true;
    this.files.updatePatient(this.patient.id!, body).subscribe({
      next: updated => {
        const finish = (prefs: ContactPreferences | null) => {
          this.saving = false;
          this.saved.emit({ patient: updated, prefs, contactChanged });
          this.close();
        };
        this.notifications.preferences(updated.id ?? this.patient.id!).subscribe({ next: p => finish(p), error: () => finish(null) });
      },
      error: err => {
        this.saving = false;
        this.serverErrors = this.apiErrors.fieldTexts(err);
        if (Object.keys(this.serverErrors).length) {
          const first = FIELDS.find(x => this.serverErrors[x.key]);
          setTimeout(() => first && (this.doc.getElementById(first.id) as HTMLElement | null)?.focus());
        } else {
          this.banner = this.apiErrors.text(err, 'pf.edit.error.save');
        }
      }
    });
  }

  close(): void {
    this.closed.emit();
    this.trigger?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    } else if (e.key === 'Tab' && this.drawerEl) {
      const els = Array.from(this.drawerEl.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!els.length) {
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = this.doc.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
