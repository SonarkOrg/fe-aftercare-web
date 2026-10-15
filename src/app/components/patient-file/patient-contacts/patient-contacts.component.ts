import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { take } from 'rxjs';
import { PatientFileService } from '../../../Services/PatientFile.service';
import { SettingsService } from '../../../Services/Settings.service';
import { StaffService } from '../../../Services/Staff.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { CareTeamMember, EmergencyContact } from '../../../models/medical.model';
import { Language } from '../../../models/settings.model';
import { STAFF_ROLES, Staff, StaffRole } from '../../../models/staff.model';
import { humanize } from '../../../shared/link.util';
import { ChipSpec, staffActiveChip } from '../../../shared/status';

interface ContactForm { id: number | null; name: string; relationship: string; phone: string; preferredLanguage: Language; errors: Record<string, string>; banner: string | null; saving: boolean }

export function sortCareTeam(list: CareTeamMember[]): CareTeamMember[] {
  return [...list].sort((a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) || a.displayName.localeCompare(b.displayName));
}

@Component({
  selector: 'app-patient-contacts',
  templateUrl: './patient-contacts.component.html'
})
export class PatientContactsComponent implements OnInit {
  @Input() patientId = 0;
  @Input() careTeam: CareTeamMember[] = [];
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
  readonly humanize = humanize;
  readonly inactiveChip: ChipSpec = staffActiveChip(false);

  constructor(private files: PatientFileService, private staffService: StaffService, private settings: SettingsService) {}

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
          f.errors = { ...api.fieldErrors };
        } else {
          f.banner = 'Could not save. Try again.';
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
      error: () => (this.actionError = 'Could not remove the contact.')
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
        this.assignError = api?.error === 'ALREADY_ASSIGNED' || api?.error === 'STAFF_INACTIVE' ? api.message : 'Could not assign the staff member.';
      }
    });
  }

  confirmUnassign(m: CareTeamMember): void {
    this.files.unassignCareTeam(this.patientId, m.assignmentId).subscribe({
      next: () => {
        this.removingMember = null;
        this.careTeamChange.emit(this.careTeam.filter(x => x.assignmentId !== m.assignmentId));
      },
      error: () => (this.actionError = 'Could not remove the team member.')
    });
  }
}
