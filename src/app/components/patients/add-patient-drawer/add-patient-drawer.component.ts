import { DOCUMENT, CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Inject, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { SettingsService } from '../../../Services/Settings.service';
import { PatientService } from '../../../Services/Patient.service';
import { PatientDeskService } from '../../../Services/PatientDesk.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { fmtDate } from '../../../i18n/format';
import { I18nModule } from '../../../i18n/i18n.module';
import { I18nService } from '../../../i18n/i18n.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { PatientMatch } from '../../../models/arrival.model';
import { Patient } from '../../../models/patient.model';
import { addDays, businessToday } from '../../../shared/link.util';

function emptyPatient(): Patient {
  return { firstName: '', lastName: '', email: '', phone: '', gender: '', dateOfBirth: null, address: { city: '', state: '', zip: '' } };
}

const blankToNull = (v: string | null | undefined): string | null => (v ?? '').trim() || null;

/**
 * The « Add patient » drawer of the Patients page. Standalone and created on demand by the page (which is part of the
 * initial bundle). Only the first and last name are required; every blank field is sent as null.
 */
@Component({
  selector: 'app-add-patient-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, I18nModule],
  templateUrl: './add-patient-drawer.component.html',
  styles: [`
    .dup-list { list-style: none; margin: 8px 0 12px; padding: 0; display: grid; gap: 8px; }
    .dup-list li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
    .consent-group { border: 0; margin: 0; padding: 0; min-width: 0; }
    .consent-group legend { padding: 0; margin-bottom: 6px; font: 600 14px/1.3 var(--font-display); }
    .consent-group .radio-row { min-height: 44px; }
  `]
})
export class AddPatientDrawerComponent implements OnInit {
  /** The drawer was closed (cancel, Escape, backdrop). */
  @Output() closed = new EventEmitter<void>();
  /** A patient was created; false when only the answer to the messages question could not be saved. */
  @Output() created = new EventEmitter<{ consentSaved: boolean }>();
  /** « Use this file »: the id of the existing patient to open. */
  @Output() useExisting = new EventEmitter<number>();
  @ViewChild('drawerEl') drawerEl?: ElementRef<HTMLElement>;

  patient: Patient = emptyPatient();
  /** Latest selectable date of birth: yesterday in the clinic's time zone. */
  readonly dobMax = addDays(businessToday(), -1);
  saving = false;
  addError: string | null = null;
  /** Per-field messages of a VALIDATION_FAILED answer, by field name ("address.city"). */
  fieldErrors: Record<string, string> = {};
  /** First answer to "accepts clinic messages?", asked once a phone or an e-mail is typed (nothing selected by default). */
  consent: 'GRANTED' | 'WITHDRAWN' | null = null;
  /** Possible duplicates of the 409 POSSIBLE_DUPLICATE answer, shown at the top of the drawer. */
  candidates: PatientMatch[] = [];

  constructor(
    private patientService: PatientService,
    private desk: PatientDeskService,
    private errors: ApiErrorsService,
    private i18n: I18nService,
    private settings: SettingsService,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  /** Gender and address are asked only when the clinic switched them on (PRIV-A-17); hidden until the settings are known. */
  collect = { gender: false, address: false };

  ngOnInit(): void {
    this.settings.clinic$.pipe(take(1)).subscribe({
      next: c => (this.collect = { gender: !!c.collectGender, address: !!c.collectAddress }),
      error: () => { /* stays hidden */ }
    });
    setTimeout(() => (this.doc.getElementById('new-firstName') as HTMLElement | null)?.focus());
  }

  close(): void {
    this.closed.emit();
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

  /** First and last name only: everything else is optional (the desk must not need a phone or an address to create a file). */
  isFormValid(): boolean {
    return this.patient.firstName.trim() !== '' && this.patient.lastName.trim() !== '';
  }

  /** Whether the messages question is asked: only once a way to reach the patient is typed. */
  get hasContact(): boolean {
    return !!(blankToNull(this.patient.email) || blankToNull(this.patient.phone));
  }

  private body(): Patient {
    const p = this.patient;
    const city = this.collect.address ? blankToNull(p.address?.city) : null;
    const state = this.collect.address ? blankToNull(p.address?.state) : null;
    const zip = this.collect.address ? blankToNull(p.address?.zip) : null;
    return {
      firstName: p.firstName.trim(), lastName: p.lastName.trim(), email: blankToNull(p.email), phone: blankToNull(p.phone),
      gender: this.collect.gender ? blankToNull(p.gender) : null, dateOfBirth: p.dateOfBirth || null,
      address: city || state || zip ? { city, state, zip } : null
    };
  }

  addPatient(confirmNew = false): void {
    this.addError = null;
    this.fieldErrors = {};
    this.candidates = [];
    this.saving = true;
    const answer = this.hasContact ? this.consent : null;
    this.patientService.addPatient(this.body(), confirmNew).subscribe({
      next: created => {
        const done = (consentSaved: boolean) => {
          this.saving = false;
          this.created.emit({ consentSaved });
        };
        if (answer && created.id != null) {
          // the patient exists now: a failed answer must not look like a failed create
          this.desk.setConsent(created.id, answer).subscribe({ next: () => done(true), error: () => done(false) });
        } else {
          done(true);
        }
      },
      error: error => {
        this.saving = false;
        const api = apiErrorOf(error);
        if (api?.error === 'POSSIBLE_DUPLICATE' && api.details?.candidates?.length) {
          this.candidates = api.details.candidates;
          setTimeout(() => (this.doc.getElementById('dup-use-0') as HTMLElement | null)?.focus());
          return;
        }
        this.addError = this.errors.text(error, 'patients.error.add');
        this.fieldErrors = this.errors.fieldTexts(error);
        console.error('Add patient error', error?.status);
      }
    });
  }

  /** « Use this file »: nothing is created, the existing file opens. */
  useCandidate(m: PatientMatch): void {
    this.useExisting.emit(m.patient.id);
  }

  nameOf(p: { firstName: string; lastName: string }): string {
    return `${p.firstName} ${p.lastName}`;
  }

  bornText(dob: string | null): string {
    return dob ? this.i18n.t('patients.duplicate.born', { date: fmtDate(dob, 'date', this.i18n.lang) }) : this.i18n.t('patients.duplicate.noDob');
  }
}
