import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { fmtClock } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { ArrivalRow } from '../../../models/arrival.model';
import { initials } from '../../../shared/link.util';
import { ChipSpec, cardNoteChip, deskChip, noQuestionnaireChip, reasonChip, walkInChip } from '../../../shared/status';

/** At most this many notices are shown as chips; the rest become a "+n" pill. */
const MAX_NOTICES = 2;

@Component({
  selector: 'app-arrival-row',
  templateUrl: './arrival-row.component.html'
})
export class ArrivalRowComponent implements OnChanges {
  @Input() row!: ArrivalRow;
  /** The highlighted row (what Enter will act on). */
  @Input() active = false;
  @Input() expanded = false;
  /** A day other than today: nothing can be changed. */
  @Input() readOnly = false;
  @Input() busy = false;
  @Output() arrive = new EventEmitter<ArrivalRow>();
  @Output() undo = new EventEmitter<ArrivalRow>();
  @Output() toggle = new EventEmitter<ArrivalRow>();
  @Output() consentSaved = new EventEmitter<{ row: ArrivalRow; value: 'GRANTED' | 'WITHDRAWN' }>();
  @Output() expirySaved = new EventEmitter<void>();
  @Output() rowChanged = new EventEmitter<ArrivalRow>();

  desk!: ChipSpec;
  reasons: ChipSpec[] = [];
  notices: ChipSpec[] = [];
  more = 0;
  noteChip: ChipSpec | null = null;
  walkInChip: ChipSpec | null = null;
  noQuestionnaireChip: ChipSpec | null = null;
  name = '';
  initials = '';
  time = '';

  constructor(private i18n: I18nService) {}

  ngOnChanges(): void {
    const r = this.row;
    this.desk = deskChip(r.desk.state);
    this.reasons = r.desk.reasons.map(reasonChip).filter((c): c is ChipSpec => c !== null);
    const notices = r.desk.notices.map(reasonChip).filter((c): c is ChipSpec => c !== null);
    this.notices = notices.slice(0, MAX_NOTICES);
    this.more = Math.max(0, notices.length - MAX_NOTICES);
    this.noteChip = r.cardNote ? cardNoteChip(r.cardNote.note) : null;
    this.walkInChip = r.walkIn ? walkInChip() : null;
    this.noQuestionnaireChip = r.questionnaire === 'NONE' ? noQuestionnaireChip() : null;
    this.name = `${r.patient.firstName} ${r.patient.lastName}`;
    this.initials = initials(r.patient.firstName, r.patient.lastName);
    this.time = fmtClock(r.scheduledAt.substring(11, 16), this.i18n.lang);
  }

  get expectedState(): boolean {
    return this.row.desk.state === 'GO' || this.row.desk.state === 'CHECK';
  }

  trackChip = (_: number, c: ChipSpec): string => (typeof c.label === 'string' ? c.label : c.label.key);
}
