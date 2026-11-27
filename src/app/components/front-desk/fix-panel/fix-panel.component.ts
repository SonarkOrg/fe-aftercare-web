import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { AppointmentService } from '../../../Services/Appointment.service';
import { ArrivalService } from '../../../Services/Arrival.service';
import { Permissions } from '../../../auth/permissions.service';
import { PatientDeskService } from '../../../Services/PatientDesk.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { I18nService } from '../../../i18n/i18n.service';
import { ArrivalRow, CardNote } from '../../../models/arrival.model';
import { businessToday } from '../../../shared/link.util';
import { formatCardExpiry, parseCardExpiry } from '../../../shared/ramq.util';
import { ContactConsent } from '../../../models/notification.model';

/** Expanded part of a row: fixes the usual blockers (consent, questionnaire link) without leaving the screen. */
@Component({
  selector: 'app-fix-panel',
  templateUrl: './fix-panel.component.html'
})
export class FixPanelComponent implements OnChanges {
  @Input() row!: ArrivalRow;
  @Input() readOnly = false;
  /** Emitted once the consent answer is saved, so the page can update the row and give the focus back to the box. */
  @Output() consentSaved = new EventEmitter<'GRANTED' | 'WITHDRAWN'>();
  /** The card expiry was saved: the page reloads the list so the reasons are recomputed. */
  @Output() expirySaved = new EventEmitter<void>();
  /** The server's new version of the row after a card note was set or removed. */
  @Output() rowChanged = new EventEmitter<ArrivalRow>();

  consent: ContactConsent = 'UNKNOWN';
  busy = false;
  error: string | null = null;
  /** The freshly created link code: lives in this component only (never logged or stored) and leaves with the panel. */
  code: string | null = null;
  expiryText = '';
  expiryError: string | null = null;

  constructor(private desk: PatientDeskService, private appointments: AppointmentService, private errors: ApiErrorsService,
              private permissions: Permissions, private arrivals: ArrivalService, private i18n: I18nService) {}

  ngOnChanges(): void {
    this.consent = this.row.patient.contactConsent;
  }

  private codes(): string[] {
    return [...this.row.desk.reasons, ...this.row.desk.notices];
  }

  /** Any of CARD_EXPIRED, CARD_EXPIRING, CARD_EXPIRY_UNKNOWN, CARD_NOT_ON_FILE, or an expired card under a card note. */
  get hasCardInfo(): boolean {
    // also an EXPIRED card whose reason a card note removed: a renewed card's expiry must still be enterable (§11.3)
    return this.codes().some(c => c.startsWith('CARD_')) || this.row.patient.card?.status === 'EXPIRED';
  }

  get notOnFile(): boolean {
    return this.codes().includes('CARD_NOT_ON_FILE');
  }

  /** « expire MM-AAAA » or « aucune date ». */
  get expiryFact(): string {
    const e = this.row.patient.card?.expiry;
    return e ? this.i18n.t('fd.card.expiryOf', { date: formatCardExpiry(e) }) : this.i18n.t('fd.fix.expiryNone');
  }

  get canCapture(): boolean {
    return this.permissions.can('HEALTH_CARD_CAPTURE');
  }

  /** « Carte non valide aujourd'hui » / « Pas de carte »: on an arrived row whose card is expired or missing, once. */
  get canNote(): boolean {
    return this.row.desk.state === 'ARRIVED' && !this.row.cardNote && (this.row.desk.reasons.includes('CARD_EXPIRED') || this.notOnFile);
  }

  get needsCompletion(): boolean {
    return this.contactMissing || this.dobMissing;
  }

  get questionnaireMissing(): boolean {
    return this.row.desk.reasons.includes('QUESTIONNAIRE_MISSING');
  }

  get contactMissing(): boolean {
    return this.row.patient.contactMissing;
  }

  get dobMissing(): boolean {
    return this.row.desk.reasons.includes('DOB_MISSING');
  }

  /** The consent question is shown when the answer is unknown and there is a contact to message (spec 7.5). */
  get askConsent(): boolean {
    return this.consent === 'UNKNOWN' && !this.contactMissing;
  }

  /**
   * A link code is a read grant on the patient's whole message thread, so its plaintext is never shown to a role without
   * CLINICAL_READ (EFVP rule A-44, which overrides spec 7.5): the desk uses « Envoyer le lien » instead.
   */
  get clinical(): boolean {
    return this.permissions.can('CLINICAL_READ');
  }

  /**
   * A walk-in never gets QUESTIONNAIRE_MISSING (the patient is standing there) and its create answer carries no code
   * (A-44), so the desk can still send its questionnaire link when consent is granted and there is a contact.
   */
  get walkInLink(): boolean {
    return this.row.walkIn && this.row.questionnaire === 'MISSING' && this.row.linkUsable && this.row.status === 'SCHEDULED'
      && this.consent === 'GRANTED' && !this.contactMissing && !this.questionnaireMissing;
  }

  get canNewLink(): boolean {
    return this.clinical && this.row.linkUsable && this.row.status === 'SCHEDULED';
  }

  answer(value: 'GRANTED' | 'WITHDRAWN'): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    this.desk.setConsent(this.row.patient.id, value).subscribe({
      next: () => {
        this.busy = false;
        this.consent = value;
        this.consentSaved.emit(value);
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'fd.error.consent');
      }
    });
  }

  newLink(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    this.appointments.regenerateCode(this.row.appointmentId).subscribe({
      next: res => {
        this.busy = false;
        this.code = res.accessCode;
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'fd.error.link');
      }
    });
  }

  saveExpiry(): void {
    if (this.busy) {
      return;
    }
    const ym = parseCardExpiry(this.expiryText, businessToday());
    if (!ym) {
      this.expiryError = this.i18n.t('fd.fix.expiryInvalid');
      return;
    }
    this.expiryError = null;
    this.busy = true;
    this.error = null;
    this.desk.setHealthCard(this.row.patient.id, { cardExpiry: ym }).subscribe({
      next: () => {
        this.busy = false;
        this.expiryText = '';
        this.expirySaved.emit();
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'fd.error.expiry');
      }
    });
  }

  setNote(note: CardNote | null): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    this.arrivals.setCardNote(this.row.appointmentId, note).subscribe({
      next: r => {
        this.busy = false;
        this.rowChanged.emit(r);
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'fd.error.note');
      }
    });
  }
}
