import { Router } from '@angular/router';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { StaffService } from '../../../Services/Staff.service';
import { Permissions } from '../../../auth/permissions.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { collate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { ACCESS_ROLES, AccessRole } from '../../../models/me.model';
import { STAFF_ROLES, Staff, StaffRequest, StaffRole } from '../../../models/staff.model';
import { ChipSpec, linkedChip, staffActiveChip } from '../../../shared/status';

export type StaffFilter = 'active' | 'inactive' | 'all';

@Component({
  selector: 'app-staff-directory',
  templateUrl: './staff-directory.component.html'
})
export class StaffDirectoryComponent implements OnInit, OnDestroy {
  readonly roles = STAFF_ROLES;
  readonly accessRoles = ACCESS_ROLES;
  readonly inactiveChip: ChipSpec = staffActiveChip(false);
  readonly linked = linkedChip(true);
  readonly notLinked = linkedChip(false);

  all: Staff[] = [];
  filter: StaffFilter = 'active';
  roleFilter: AccessRole | 'all' = 'all';
  /** The row (the signed-in member) waiting for "You will lose access immediately." to be confirmed. */
  selfConfirm: number | null = null;
  loading = true;
  loadError = false;
  actionError: string | null = null;

  drawerOpen = false;
  editId: number | null = null;
  form = { displayName: '', email: '', role: 'NURSE' as StaffRole, accessRole: 'NURSE' as AccessRole, auth0Subject: '' };
  errors: Record<string, string> = {};
  banner: string | null = null;
  saving = false;

  @ViewChild('drawerEl') drawerEl?: ElementRef<HTMLElement>;
  private trigger: HTMLElement | null = null;

  constructor(private staff: StaffService, private permissions: Permissions, private router: Router, private i18n: I18nService, private errors2: ApiErrorsService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('drawer-open');
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this.staff.list(true).subscribe({
      next: s => {
        this.all = s;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  byId = (_: number, s: Staff) => s.id;

  count(f: StaffFilter): number {
    return f === 'all' ? this.all.length : this.all.filter(s => (f === 'active') === s.active).length;
  }

  get visible(): Staff[] {
    const byState = this.filter === 'all' ? this.all : this.all.filter(s => (this.filter === 'active') === s.active);
    return this.roleFilter === 'all' ? byState : byState.filter(s => s.accessRole === this.roleFilter);
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  }

  menuItems(s: Staff) {
    return [{ key: 'edit', label: this.i18n.t('common.edit') }, { key: s.active ? 'deactivate' : 'reactivate', label: this.i18n.t(s.active ? 'settings.staff.deactivate' : 'settings.staff.reactivate') }];
  }

  onMenu(s: Staff, key: string): void {
    if (key === 'edit') {
      this.openDrawer(s, null);
    } else if (key === 'deactivate' && this.permissions.me?.staffId === s.id) {
      this.actionError = null;
      this.selfConfirm = s.id;
    } else {
      this.run(s, key);
    }
  }

  /** Deactivating yourself is allowed unless you are the last admin; the next request then gets NOT_STAFF. */
  confirmSelf(s: Staff): void {
    this.selfConfirm = null;
    this.run(s, 'deactivate', true);
  }

  private run(s: Staff, key: string, self = false): void {
    this.actionError = null;
    (key === 'deactivate' ? this.staff.deactivate(s.id) : this.staff.reactivate(s.id)).subscribe({
      next: u => {
        this.all = this.all.map(x => (x.id === u.id ? u : x));
        if (self) {
          this.permissions.load(true).subscribe({ error: () => { /* NOT_STAFF: the interceptor sends us to /not-staff */ } });
        }
      },
      error: err => (this.actionError = this.errors2.text(err, key === 'deactivate' ? 'settings.staff.error.deactivate' : 'settings.staff.error.reactivate'))
    });
  }

  /* ---------- add / edit drawer ---------- */

  openDrawer(s: Staff | null, trigger: HTMLElement | null): void {
    this.trigger = trigger ?? (document.activeElement as HTMLElement | null);
    this.editId = s?.id ?? null;
    this.form = { displayName: s?.displayName ?? '', email: s?.email ?? '', role: s?.role ?? 'NURSE', accessRole: s?.accessRole ?? 'NURSE', auth0Subject: s?.auth0Subject ?? '' };
    this.errors = {};
    this.banner = null;
    this.drawerOpen = true;
    document.body.classList.add('drawer-open');
    setTimeout(() => document.getElementById('st-name')?.focus());
  }

  closeDrawer(): void {
    if (!this.drawerOpen) {
      return;
    }
    this.drawerOpen = false;
    document.body.classList.remove('drawer-open');
    this.trigger?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.drawerOpen) {
      return;
    }
    if (e.key === 'Escape') {
      this.closeDrawer();
    } else if (e.key === 'Tab' && this.drawerEl) {
      const els = Array.from(this.drawerEl.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!els.length) {
        return;
      }
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els[els.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
        e.preventDefault();
        els[0].focus();
      }
    }
  }

  get canSave(): boolean {
    return !this.saving && this.form.displayName.trim().length > 0;
  }

  save(): void {
    if (!this.canSave) {
      return;
    }
    this.saving = true;
    this.errors = {};
    this.banner = null;
    const req: StaffRequest = {
      displayName: this.form.displayName.trim(), email: this.form.email.trim() || null, role: this.form.role, accessRole: this.form.accessRole,
      auth0Subject: this.form.auth0Subject.trim() || null
    };
    const call = this.editId === null ? this.staff.create(req) : this.staff.update(this.editId, req);
    call.subscribe({
      next: s => {
        this.saving = false;
        this.all = this.editId === null ? [...this.all, s] : this.all.map(x => (x.id === s.id ? s : x));
        this.all = [...this.all].sort((a, b) => collate(a.displayName, b.displayName));
        this.closeDrawer();
        if (this.editId !== null && this.permissions.me?.staffId === s.id) {
          // our own role may have changed: refresh permissions and leave if Settings is no longer allowed
          this.permissions.load(true).subscribe({
            next: () => {
              if (!this.permissions.can('SETTINGS_MANAGE')) {
                this.router.navigate(['/dashboard']);
              }
            },
            error: () => { /* keep the current permissions */ }
          });
        }
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (api && api.error === 'VALIDATION_FAILED' && Object.keys(api.fieldErrors).length) {
          this.errors = this.errors2.fieldTexts(err);
        } else {
          this.banner = this.errors2.text(err, 'settings.staff.error.save');
        }
      }
    });
  }
}
