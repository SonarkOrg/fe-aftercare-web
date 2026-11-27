import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CardWarning } from '../../../models/arrival.model';

/** The state of the card flow, as the page sets it. Never carries a number. */
export type CardBannerState =
  | { kind: 'recognised' }
  | { kind: 'multi'; count: number }
  | { kind: 'candidates' }
  | { kind: 'none' }
  | { kind: 'mismatch' }
  | { kind: 'inUse'; underOne: boolean };

/** One banner for every outcome of a card lookup (spec 11.5). Texts only: the page decides what each button does. */
@Component({
  selector: 'app-card-banner',
  templateUrl: './card-banner.component.html'
})
export class CardBannerComponent {
  @Input() state!: CardBannerState;
  @Input() warnings: CardWarning[] = [];
  @Input() clinical = false;
  @Input() busy = false;
  @Output() flagDuplicates = new EventEmitter<void>();
  @Output() noteWithout = new EventEmitter<void>();
  @Output() reason = new EventEmitter<'PARENT_CARD_CHILD_UNDER_1' | 'OTHER'>();

  get mismatchBirth(): boolean {
    return this.warnings.includes('CARD_BIRTH_DATE_MISMATCH');
  }

  get glyph(): string {
    return this.state.kind === 'recognised' ? '✓' : this.state.kind === 'mismatch' ? '▲' : this.state.kind === 'none' ? 'ℹ' : '●';
  }

  get tone(): string {
    return this.state.kind === 'recognised' ? 'info' : this.state.kind === 'mismatch' ? 'error' : this.state.kind === 'none' ? 'info' : 'warning';
  }
}
