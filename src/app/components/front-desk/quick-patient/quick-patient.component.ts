import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { PatientDeskService } from '../../../Services/PatientDesk.service';
import { Permissions } from '../../../auth/permissions.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { I18nService } from '../../../i18n/i18n.service';
import { PatientMatch, QuickPatientRequest, QuickPatientResponse, SharedCardReason } from '../../../models/arrival.model';
import { apiErrorOf } from '../../../models/api-error.model';
import { Language } from '../../../models/settings.model';
import { businessToday } from '../../../shared/link.util';
import { birthDatesFromRamq, isValidRamq, looksLikeNam, normalizeRamq, parseCardExpiry } from '../../../shared/ramq.util';
import { parseBirthDate } from '../desk-search';

/** What the page knows when it opens the drawer: text taken from the box, never a card number. */
export interface QuickPrefill { firstName: string; lastName: string; dateOfBirth: string; phone: string }
/** The patient created by the previous quick create of this page (for « Autre enfant du même parent »). */
export interface RecentPatient { id: number; name: string; lastName: string; at: number }

/** Ten minutes: how long « Autre enfant du même parent » stays offered. */
export const SIBLING_WINDOW_MS = 10 * 60 * 1000;

/**
 * The quick-patient drawer (spec 11.5): three required fields, the phone and the consent question beside it, the rest under
 * « Plus ». The card number reaches this component only as `cardNam` (read by the page) and goes only into the request body.
 */
@Component({
  selector: 'app-quick-patient',
  templateUrl: './quick-patient.component.html'
})
export class QuickPatientComponent implements OnInit, OnChanges {
  @Input() prefill: QuickPrefill = { firstName: '', lastName: '', dateOfBirth: '', phone: '' };
  /** The card number the page holds in memory; never displayed. */
  /**
   * The card read by the page, as an OBJECT: Angular dev mode mirrors primitive inputs into `ng-reflect-*` DOM attributes,
   * so a string input would put the number in the DOM (review p1b); an object shows as "[object Object]".
   */
  @Input() card: { nam: string } | null = null;

  get cardNam(): string | null {
    return this.card?.nam ?? null;
  }
  @Input() recent: RecentPatient | null = null;
  @Output() created = new EventEmitter<QuickPatientResponse>();
  @Output() cancelled = new EventEmitter<void>();
  /** « Utiliser ce dossier » on a candidate. */
  @Output() useMatch = new EventEmitter<PatientMatch>();
  /** The « Retirer » link of the card line. */
  @Output() cardRemoved = new EventEmitter<void>();

  @ViewChild('useBtn') useBtn?: ElementRef<HTMLButtonElement>;

  firstName = '';
  lastName = '';
  dob = '';
  phone = '';
  email = '';
  language: '' | Language = '';
  consent: 'GRANTED' | 'WITHDRAWN' | null = null;
  cardField = '';
  cardExpiry = '';
  copyFrom: RecentPatient | null = null;
  dobFromCard = false;

  saving = false;
  error: string | null = null;
  fieldErrors: Record<string, string> = {};
  candidates: PatientMatch[] = [];
  /** `POSSIBLE_DUPLICATE` or `HEALTH_NUMBER_IN_USE`: decides what « Créer quand même » re-sends. */
  conflict: 'POSSIBLE_DUPLICATE' | 'HEALTH_NUMBER_IN_USE' | null = null;
  /** « Créer quand même » was chosen on POSSIBLE_DUPLICATE: sent with every later attempt until the conflict is dismissed. */
  confirmedNew = false;
  sharedReason: SharedCardReason | null = null;
  private sub?: Subscription;

  constructor(private desk: PatientDeskService, private errors: ApiErrorsService, private permissions: Permissions, private i18n: I18nService) {}

  ngOnInit(): void {
    this.firstName = this.prefill.firstName;
    this.lastName = this.prefill.lastName;
    this.dob = this.prefill.dateOfBirth;
    this.phone = this.prefill.phone;
    this.applyCardDate();
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['card'] && !c['card'].firstChange) {
      this.applyCardDate();
    }
  }

  /** A date of birth is taken from the card only when it can stand for exactly one date, and never overwrites typing. */
  private applyCardDate(): void {
    if (!this.cardNam || this.dob.trim()) {
      return;
    }
    const dates = birthDatesFromRamq(this.cardNam, businessToday());
    if (dates.length === 1) {
      this.dob = dates[0];
      this.dobFromCard = true;
    }
  }

  get canCapture(): boolean {
    return this.permissions.can('HEALTH_CARD_CAPTURE');
  }

  get clinical(): boolean {
    return this.permissions.can('CLINICAL_WRITE');
  }

  get hasContact(): boolean {
    return !!(this.phone.trim() || this.email.trim());
  }

  get siblingOffered(): boolean {
    return !!this.recent && !this.copyFrom && Date.now() - this.recent.at < SIBLING_WINDOW_MS;
  }

  get underOne(): boolean {
    const iso = parseBirthDate(this.dob, businessToday());
    if (!iso) {
      return false;
    }
    const t = businessToday();
    const limit = `${Number(t.slice(0, 4)) - 1}${t.slice(4)}`;
    return iso > limit;
  }

  swap(): void {
    [this.firstName, this.lastName] = [this.lastName, this.firstName];
  }

  copyFromRecent(): void {
    if (this.recent) {
      this.copyFrom = this.recent;
      this.lastName = this.recent.lastName; // an explicit click: the sibling's family name wins over text carried from the box
    }
  }

  pickConsent(v: 'GRANTED' | 'WITHDRAWN'): void {
    this.consent = this.consent === v ? null : v;
  }

  /** Enter submits everywhere in the drawer; on a consent button it keeps that answer (never toggles it off) and submits. */
  enterOnConsent(v: 'GRANTED' | 'WITHDRAWN'): void {
    this.consent = v;
    this.submit();
  }

  private validate(): QuickPatientRequest | null {
    const f: Record<string, string> = {};
    const req = this.i18n.t('fd.quick.required');
    if (!this.firstName.trim()) { f['firstName'] = req; } else if (looksLikeNam(this.firstName)) { f['firstName'] = this.i18n.t('error.field.looksLikeHealthNumber'); }
    if (!this.lastName.trim()) { f['lastName'] = req; } else if (looksLikeNam(this.lastName)) { f['lastName'] = this.i18n.t('error.field.looksLikeHealthNumber'); }
    const dob = parseBirthDate(this.dob, businessToday());
    if (!dob) { f['dateOfBirth'] = this.dob.trim() ? this.i18n.t('fd.quick.dobInvalid') : req; }
    let nam: string | null = this.cardNam;
    if (!nam && this.cardField.trim()) {
      const n = normalizeRamq(this.cardField);
      if (isValidRamq(n)) { nam = n; } else { f['healthNumber'] = this.i18n.t('fd.quick.cardInvalid'); }
    }
    let expiry: string | null = null;
    if (this.cardExpiry.trim()) {
      expiry = parseCardExpiry(this.cardExpiry, businessToday());
      if (!expiry) { f['cardExpiry'] = this.i18n.t('fd.fix.expiryInvalid'); }
    }
    this.fieldErrors = f;
    if (Object.keys(f).length || !dob) {
      return null;
    }
    const body: QuickPatientRequest = { firstName: this.firstName.trim(), lastName: this.lastName.trim(), dateOfBirth: dob };
    if (this.phone.trim()) { body.phone = this.phone.trim(); }
    if (this.email.trim()) { body.email = this.email.trim(); }
    if (this.language) { body.preferredLanguage = this.language; }
    if (this.hasContact && this.consent) { body.contactConsent = this.consent; }
    if (this.copyFrom) { body.copyContactFrom = this.copyFrom.id; }
    if (nam) { body.healthNumber = nam; }
    if (expiry) { body.cardExpiry = expiry; }
    if (this.sharedReason) { body.sharedCardReason = this.sharedReason; }
    return body;
  }

  submit(confirmNew = false, reason: SharedCardReason | null = null): void {
    if (this.saving) {
      return;
    }
    if (reason) {
      this.sharedReason = reason;
    }
    const body = this.validate();
    if (!body) {
      return;
    }
    if (confirmNew) {
      // once confirmed, every later attempt of this form keeps it (a following HEALTH_NUMBER_IN_USE must not undo it)
      this.confirmedNew = true;
    }
    if (this.confirmedNew) {
      body.confirmNew = true;
    }
    this.saving = true;
    this.error = null;
    this.sub?.unsubscribe();
    this.sub = this.desk.quickCreate(body).subscribe({
      next: res => {
        this.saving = false;
        this.created.emit(res);
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (err?.status === 409 && api && (api.error === 'POSSIBLE_DUPLICATE' || api.error === 'HEALTH_NUMBER_IN_USE')) {
          this.conflict = api.error;
          this.candidates = api.details?.candidates ?? [];
          setTimeout(() => this.useBtn?.nativeElement.focus());
          return;
        }
        if (err?.status === 400 && api?.error === 'VALIDATION_FAILED') {
          this.fieldErrors = this.errors.fieldTexts(err);
          return;
        }
        this.error = this.errors.text(err, 'fd.error.create');
      }
    });
  }

  /** « Créer quand même »: for a duplicate name it re-sends with `confirmNew`; for a number already in use it needs a reason first. */
  createAnyway(): void {
    if (this.conflict === 'HEALTH_NUMBER_IN_USE') {
      return;
    }
    this.submit(true);
  }

  pickReason(reason: SharedCardReason): void {
    this.submit(this.conflict === 'POSSIBLE_DUPLICATE', reason);
  }

  dismissConflict(): void {
    this.confirmedNew = false;
    this.conflict = null;
    this.candidates = [];
    this.sharedReason = null;
  }

  trackMatch = (_: number, m: PatientMatch): number => m.patient.id;
}
