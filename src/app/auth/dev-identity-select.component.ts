import { NgForOf } from '@angular/common';
import { Component } from '@angular/core';
import { DevIdentity, DevStaffAuth } from './dev-staff-auth';

interface Option { key: string; label: string; identity: DevIdentity }

export const DEV_OPTIONS: Option[] = [
  { key: 'ADMIN', label: 'Admin (dev|admin-1)', identity: { role: 'ADMIN' } },
  { key: 'PHYSICIAN', label: 'Physician (auth0|seed-surgeon)', identity: { role: 'PHYSICIAN' } },
  { key: 'NURSE', label: 'Nurse (dev|nurse-1)', identity: { role: 'NURSE' } },
  { key: 'RECEPTION', label: 'Reception (dev|reception-1)', identity: { role: 'RECEPTION' } },
  { key: 'UNLINKED', label: 'Unlinked login (dev|unlinked)', identity: { sub: 'dev|unlinked' } }
];

/** Development builds only: switch between the seeded logins. */
@Component({
  selector: 'app-dev-identity-select',
  standalone: true,
  imports: [NgForOf],
  template: `
    <div class="form-group dev-identity">
      <label for="dev-role">Dev identity</label>
      <select id="dev-role" aria-label="Dev identity" [value]="current" (change)="choose($any($event.target).value)">
        <option *ngFor="let o of options" [value]="o.key" [selected]="o.key === current">{{ o.label }}</option>
      </select>
    </div>`
})
export class DevIdentitySelectComponent {
  readonly options = DEV_OPTIONS;

  constructor(private auth: DevStaffAuth) {}

  get current(): string {
    const { role, sub } = this.auth.identity;
    return sub ? 'UNLINKED' : role ?? 'ADMIN';
  }

  choose(key: string): void {
    const o = DEV_OPTIONS.find(x => x.key === key);
    if (o && o.key !== this.current) {
      this.auth.switchIdentity(o.identity);
    }
  }
}
