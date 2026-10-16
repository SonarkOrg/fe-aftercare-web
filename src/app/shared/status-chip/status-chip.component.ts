import { Component, Input } from '@angular/core';
import { ChipSpec } from '../status';

@Component({
  selector: 'app-status-chip',
  template: `<span class="chip chip--{{spec.tone}}" [class.chip--sm]="size === 'sm'" [attr.title]="useShort ? (spec.label | t) : null"><span class="chip__glyph" aria-hidden="true">{{ spec.glyph }}</span><span class="chip__label" *ngIf="!useShort">{{ spec.label | t }}</span><ng-container *ngIf="useShort"><span class="chip__label" aria-hidden="true">{{ spec.short | t }}</span><span class="sr-only">{{ spec.label | t }}</span></ng-container></span>`
})
export class StatusChipComponent {
  @Input() spec!: ChipSpec;
  @Input() size: 'sm' | 'md' = 'md';
  /** Show `spec.short` (narrow cards); the long label stays in the title and for screen readers. */
  @Input() short = false;

  get useShort(): boolean {
    return this.short && !!this.spec.short;
  }
}
