import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { AppointmentType } from '../../../models/appointment.model';
import { Specialty } from '../../../models/follow-up.model';

export interface WalkInChoice { type: AppointmentType; specialty: Specialty }

export const WALK_IN_KEY = 'aftercare.fd.walkIn';
export const WALK_IN_TYPES: AppointmentType[] = ['GENERAL_CONSULT', 'PRE_OP_CONSULT', 'POST_OP_FOLLOWUP', 'SURGERY'];
export const WALK_IN_SPECIALTIES: Specialty[] = ['ORTHOPEDIC_SURGERY', 'VISCERAL_SURGERY'];

/** The last choice, from localStorage (type and specialty only, not PHI). Anything unreadable gives null. */
export function readWalkInChoice(options: WalkInChoice[] | null | undefined): WalkInChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(WALK_IN_KEY) ?? 'null') as Partial<WalkInChoice> | null;
    if (raw && WALK_IN_TYPES.includes(raw.type as AppointmentType) && WALK_IN_SPECIALTIES.includes(raw.specialty as Specialty)) {
      return { type: raw.type as AppointmentType, specialty: raw.specialty as Specialty };
    }
  } catch { /* storage may be blocked or hold something else: use the default */ }
  return options && options.length ? { type: options[0].type, specialty: options[0].specialty } : { type: 'GENERAL_CONSULT', specialty: WALK_IN_SPECIALTIES[0] };
}

export function writeWalkInChoice(c: WalkInChoice): void {
  try {
    localStorage.setItem(WALK_IN_KEY, JSON.stringify({ type: c.type, specialty: c.specialty }));
  } catch { /* the choice is just not remembered */ }
}

/**
 * « Sans rendez-vous »: two selects. The page creates the visit when Enter is pressed in its box (the focus never leaves it),
 * and Tab in the box cycles the type, so a visit is a few keys.
 */
@Component({
  selector: 'app-walk-in',
  templateUrl: './walk-in.component.html'
})
export class WalkInComponent implements OnChanges {
  @Input() name = '';
  @Input() choice: WalkInChoice = { type: 'GENERAL_CONSULT', specialty: 'ORTHOPEDIC_SURGERY' };
  /** Pairs that have an active questionnaire (missing counts as none). */
  @Input() options: WalkInChoice[] | null | undefined = [];
  @Input() busy = false;
  @Output() choiceChange = new EventEmitter<WalkInChoice>();
  @Output() create = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  types = WALK_IN_TYPES;
  specialties = WALK_IN_SPECIALTIES;
  hasQuestionnaire = true;

  ngOnChanges(): void {
    this.hasQuestionnaire = (this.options ?? []).some(o => o.type === this.choice.type && o.specialty === this.choice.specialty);
  }

  setType(t: AppointmentType): void {
    this.emit({ ...this.choice, type: t });
  }

  setSpecialty(s: Specialty): void {
    this.emit({ ...this.choice, specialty: s });
  }

  private emit(c: WalkInChoice): void {
    writeWalkInChoice(c);
    this.choiceChange.emit(c);
  }
}
