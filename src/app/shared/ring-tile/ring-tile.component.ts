import { Component, Input } from '@angular/core';
import { IconName } from '../icon/icon.component';

export const RING_C = 2 * Math.PI * 21.5; // circumference of r = 21.5

@Component({
  selector: 'app-ring-tile',
  template: `<a class="tile" *ngIf="link; else plain" [routerLink]="link" [queryParams]="params"><ng-container *ngTemplateOutlet="body"></ng-container></a>
<ng-template #plain><div class="tile"><ng-container *ngTemplateOutlet="body"></ng-container></div></ng-template>
<ng-template #body>
  <span class="ring" role="img" [attr.aria-label]="aria">
    <svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="21.5" fill="#fefefe" stroke="var(--ring-track)" stroke-width="3"/>
      <circle *ngIf="ratio > 0" class="ring__arc" cx="23" cy="23" r="21.5" fill="none" stroke="var(--sage-600)" stroke-width="3" [attr.stroke-dasharray]="c" [attr.stroke-dashoffset]="c * (1 - ratio)" transform="translate(46 0) scale(-1 1) rotate(-90 23 23)"/></svg>
    <app-icon [name]="icon" [size]="20" [stroke]="1.5"></app-icon>
  </span>
  <span class="tile__label"><ng-container *ngFor="let l of lines; let last = last">{{ last ? l : l + ' ' }}<br *ngIf="!last"></ng-container></span>
  <span class="tile__value">{{ value }}<i *ngIf="total !== null"> / {{ total }}</i></span>
  <span class="tile__sub" *ngIf="sub">{{ sub }}</span>
</ng-template>`
})
export class RingTileComponent {
  @Input() label = '';
  @Input() value: number | string = 0;
  /** Denominator; null for a tile without one (the ring is then full). */
  @Input() total: number | null = null;
  @Input() icon: IconName = 'users';
  /** Router link of the whole tile; null renders a plain, non-interactive tile. */
  @Input() link: string | unknown[] | null = null;
  @Input() params: Record<string, unknown> | null = null;
  @Input() sub = '';
  /** Overrides value/total when the ring should show another ratio (for example 60 % completed). */
  @Input() ratioOverride: number | null = null;

  readonly c = RING_C;

  get lines(): string[] {
    return this.label.split('\n');
  }

  get ratio(): number {
    if (this.ratioOverride !== null) {
      return Math.min(Math.max(this.ratioOverride, 0), 1);
    }
    if (this.total === null) {
      return 1;
    }
    const v = Number(this.value);
    return this.total > 0 && Number.isFinite(v) ? Math.min(Math.max(v / this.total, 0), 1) : 0;
  }

  get aria(): string {
    return `${this.label.replace('\n', ' ')}: ${this.value}${this.total !== null ? ' of ' + this.total : ''}`;
  }
}
