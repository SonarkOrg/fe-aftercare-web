import { Component, Input } from '@angular/core';
import { AppointmentStatus } from '../../models/appointment.model';
import type { CardNote } from '../../models/arrival.model';
import { appointmentChip, arrivalChip, cardNoteChip, ChipSpec, GLYPH } from '../status';

/** Neutral, no action: a walk-in visit created without a questionnaire (phase 1B). */
const NO_QUESTIONNAIRE: ChipSpec = { tone: 'neutral', glyph: GLYPH.neutral, label: { key: 'appts.noQuestionnaire' } };
const WALK_IN: ChipSpec = { tone: 'neutral', glyph: GLYPH.neutral, label: { key: 'appts.walkInTag' } };

@Component({
  selector: 'app-appointment-badge',
  template: `<app-status-chip [spec]="chip" [size]="size"></app-status-chip><app-status-chip *ngIf="arrival as c" class="arrival-chip" [spec]="c" [size]="size"></app-status-chip><app-status-chip *ngIf="walkIn" class="walk-in-chip" [spec]="walkInChip" [size]="size"></app-status-chip><app-status-chip *ngIf="cardNote as c" class="card-note-chip" [spec]="c" [size]="size"></app-status-chip>`
})
export class AppointmentBadgeComponent {
  @Input() appointment!: {
    status: AppointmentStatus;
    questionnaireMissing: boolean;
    arrivedAt?: string | null;
    /** Strictly null = no questionnaire at all (walk-in); undefined = field absent (older payloads / fixtures). */
    questionnaireDefinitionId?: number | null;
    walkIn?: boolean;
    cardNote?: CardNote | null;
  };
  @Input() size: 'sm' | 'md' = 'md';

  readonly walkInChip = WALK_IN;

  /** An open appointment with no questionnaire is not « missing »: it never had one (no send-link, no warning). */
  get chip(): ChipSpec {
    const a = this.appointment;
    return a.status === 'SCHEDULED' && a.questionnaireDefinitionId === null ? NO_QUESTIONNAIRE : appointmentChip(a);
  }

  /** A second small chip once the patient is at the clinic; the status chip itself is untouched. */
  get arrival() {
    return arrivalChip({ arrivedAt: this.appointment.arrivedAt ?? null, status: this.appointment.status });
  }

  get walkIn(): boolean {
    return this.appointment.walkIn === true;
  }

  get cardNote(): ChipSpec | null {
    const n = this.appointment.cardNote;
    return n ? cardNoteChip(n) : null;
  }
}
