import { Component, Input } from '@angular/core';
import { AccessRole, ROLE_LABEL } from '../../models/me.model';

/** A small chip with the access role: glyph + word, never colour alone. */
@Component({
  selector: 'app-role-badge',
  template: `<span *ngIf="role" class="chip chip--sm role-badge" [class.chip--info]="role === 'ADMIN'" [class.chip--neutral]="role !== 'ADMIN'"
    role="img" [attr.aria-label]="'Access role: ' + label"><span class="chip__glyph" aria-hidden="true">{{ role === 'ADMIN' ? '◆' : '◇' }}</span><span class="chip__label">{{ label }}</span></span>`
})
export class RoleBadgeComponent {
  @Input() role: AccessRole | null | undefined = null;

  get label(): string {
    return this.role ? ROLE_LABEL[this.role] : '';
  }
}
