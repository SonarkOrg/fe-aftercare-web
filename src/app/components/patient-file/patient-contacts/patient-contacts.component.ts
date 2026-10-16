import { ContactPreferences } from '../../../models/notification.model';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { take } from 'rxjs';
import { Permissions } from '../../../auth/permissions.service';
import { PatientFileService } from '../../../Services/PatientFile.service';
import { SettingsService } from '../../../Services/Settings.service';
import { StaffService } from '../../../Services/Staff.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { collate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { CareTeamMember, EmergencyContact } from '../../../models/medical.model';
import { Language } from '../../../models/settings.model';
import { STAFF_ROLES, Staff, StaffRole } from '../../../models/staff.model';
import { ChipSpec, staffActiveChip } from '../../../shared/status';

interface ContactForm { id: number | null; name: string; relationship: string; phone: string; preferredLanguage: Language; errors: Record<string, string>; banner: string | null; saving: boolean }

export function sortCareTeam(list: CareTeamMember[]): CareTeamMember[] {
  return [...list].sort((a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) || collate(a.displayName, b.displayName));
}

@Component({
  selector: 'app-patient-contacts',
  templateUrl: './patient-contacts.component.html'
})
export class PatientContactsComponent implements OnInit {
  @Input() patientId = 0;
  @Input() careTeam: CareTeamMember[] = [];
  @Output() prefsSaved = new EventEmitter<ContactPreferences>();
  /** The "Edit details" button was used; carries it so the drawer can return the focus. */
  @Output() editDetails = new EventEmitter<HTMLElement>();
  @Output() careTeamChange = new EventEmitter<CareTeamMember[]>();

  contacts: EmergencyContact[] = [];
  loading = true;
  loadError = false;
  form: ContactForm | null = null;
  removingContact: number | null = null;
  removingMember: number | null = null;
  staff: Staff[] = [];
  defaultLang: Language = 'FR';
  assignStaffId = '';
  assignRole: '' | StaffRole = '';
  assignError: string | null = null;
  assigning = false;
  actionError: string | null = null;

  readonly roles = STAFF_ROLES;
  readonly inactiveChip: ChipSpec = staffActiveChip(false);

  constructor(private files: PatientFileService, private staffService: StaffService, private settings: SettingsService, public permissions: Permissions, private i18n: I18nService, private errors: ApiErrorsService) {}

  menuItems(): { key: string; label: string }[] {
    return [{ key: 'edit', label: this.i18n.t('common.edit') }, { key: 'remove', label: this.i18n.t('common.remove') }];
  }

  ngOnInit(): void {
    this.loadContacts();
    this.staffService.list(false).subscribe({ next: s => (this.staff = s), error: () => { /* the assign form shows its empty state */ } });
    this.settings.clinic$.pipe(take(1)).subscribe({ next: c => (this.defaultLang = c.defaultLanguage), error: () => { /* keep FR */ } });
  }

  loadContacts(): void {
    this.loading = true;
    this.loadError = false;
    this.files.contacts(this.patientId).subscribe({
      next: c => {
        this.contacts = c;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      }
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  }

  get assignable(): Staff[] {
    const taken = new Set(this.careTeam.map(m => m.staffId));
    return this.staff.filter(s => s.active && !taken.has(s.id));
  }

  /* ---------- emergency contacts ---------- */

  openForm(c?: EmergencyContact): void {
    this.removingContact = null;
    this.form = {
      id: c?.id ?? null, name: c?.name ?? '', relationship: c?.relationship ?? '', phone: c?.phone ?? '',
      preferredLanguage: c?.preferredLanguage ?? this.defaultLang, errors: {}, banner: null, saving: false
    };
    setTimeout(() => (document.getElementById('ec-name') as HTMLElement | null)?.focus());
  }

  get canSave(): boolean {
    const f = this.form;
    return !!f && !f.saving && !!f.name.trim() && !!f.relationship.trim() && !!f.phone.trim();
  }

  save(): void {
    const f = this.form;
    if (!f || !this.canSave) {
      return;
    }
    f.saving = true;
    f.errors = {};
    f.banner = null;
    const req = { name: f.name.trim(), relationship: f.relationship.trim(), phone: f.phone.trim(), preferredLanguage: f.preferredLanguage };
    const call = f.id === null ? this.files.addContact(this.patientId, req) : this.files.updateContact(this.patientId, f.id, req);
    call.subscribe({
      next: saved => {
        this.contacts = f.id === null ? [...this.contacts, saved] : this.contacts.map(c => (c.id === saved.id ? saved : c));
        this.form = null;
      },
      error: err => {
        f.saving = false;
        const api = apiErrorOf(err);
        if (api && Object.keys(api.fieldErrors).length) {
          f.errors = this.errors.fieldTexts(err);
        } else {
          f.banner = this.errors.text(err, 'pf.medical.error.save');
        }
      }
    });
  }

  onContactMenu(c: EmergencyContact, key: string): void {
    if (key === 'edit') {
      this.openForm(c);
    } else {
      this.form = null;
      this.removingContact = c.id;
    }
  }

  confirmRemoveContact(c: EmergencyContact): void {
    this.files.removeContact(this.patientId, c.id).subscribe({
      next: () => {
        this.contacts = this.contacts.filter(x => x.id !== c.id);
        this.removingContact = null;
      },
      error: err => (this.actionError = this.errors.text(err, 'pf.contacts.error.remove'))
    });
  }

  /* ---------- care team ---------- */

  assign(): void {
    if (!this.assignStaffId || this.assigning) {
      return;
    }
    this.assigning = true;
    this.assignError = null;
    this.files.assignCareTeam(this.patientId, { staffId: Number(this.assignStaffId), role: this.assignRole || null }).subscribe({
      next: m => {
        this.assigning = false;
        this.assignStaffId = '';
        this.assignRole = '';
        this.careTeamChange.emit(sortCareTeam([...this.careTeam, m]));
      },
      error: err => {
        this.assigning = false;
        const api = apiErrorOf(err);
        this.assignError = this.errors.text(err, 'pf.contacts.error.assign');
      }
    });
  }

  confirmUnassign(m: CareTeamMember): void {
    this.files.unassignCareTeam(this.patientId, m.assignmentId).subscribe({
      next: () => {
        this.removingMember = null;
        this.careTeamChange.emit(this.careTeam.filter(x => x.assignmentId !== m.assignmentId));
      },
      error: err => (this.actionError = this.errors.text(err, 'pf.contacts.error.unassign'))
    });
  }
}
