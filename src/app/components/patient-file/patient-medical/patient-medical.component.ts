import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { PatientFileService } from '../../../Services/PatientFile.service';
import { StaffService } from '../../../Services/Staff.service';
import { ApiError, apiErrorOf } from '../../../models/api-error.model';
import { AllergySeverity, MedicalList, PatientMedical } from '../../../models/medical.model';
import { Patient } from '../../../models/patient.model';
import { Staff } from '../../../models/staff.model';
import { ageOn } from '../../../shared/age.util';
import { addDays, businessToday, humanize } from '../../../shared/link.util';
import { fmtDayYear } from '../../../shared/messages.util';
import { formatRamq, isValidRamq } from '../../../shared/ramq.util';
import { ChipSpec, allergyChip } from '../../../shared/status';

export const REVEAL_MS = 30_000;

export interface FieldDef {
  key: string; label: string; type: 'text' | 'select' | 'date' | 'surgeon';
  required?: boolean; max?: number; options?: { value: string; label: string }[]; helper?: string; mono?: boolean;
}
export interface ListCfg { key: MedicalList; title: string; addLabel: string; empty: string; fields: FieldDef[]; dated?: boolean }

const SEVERITIES: AllergySeverity[] = ['SEVERE', 'MODERATE', 'MILD', 'UNKNOWN'];

export const LISTS: ListCfg[] = [
  {
    key: 'allergies', title: 'Allergies', addLabel: 'Add allergy', empty: 'No known allergies recorded.',
    fields: [
      { key: 'substance', label: 'Substance', type: 'text', required: true, max: 200 },
      { key: 'severity', label: 'Severity', type: 'select', required: true, options: SEVERITIES.map(s => ({ value: s, label: humanize(s) })) },
      { key: 'reaction', label: 'Reaction', type: 'text', max: 500 }
    ]
  },
  {
    key: 'medications', title: 'Medications', addLabel: 'Add medication', empty: 'No medications recorded.',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, max: 200 },
      { key: 'dose', label: 'Dose', type: 'text', max: 100 },
      { key: 'frequency', label: 'Frequency', type: 'text', max: 100 },
      { key: 'startDate', label: 'Start date', type: 'date' }
    ]
  },
  {
    key: 'procedures', title: 'Procedures', addLabel: 'Add procedure', empty: 'No procedures recorded.', dated: true,
    fields: [
      { key: 'name', label: 'Procedure', type: 'text', required: true, max: 200 },
      { key: 'performedOn', label: 'Performed on', type: 'date', required: true },
      { key: 'surgeon', label: 'Surgeon', type: 'surgeon' }
    ]
  },
  {
    key: 'diagnoses', title: 'Diagnoses', addLabel: 'Add diagnosis', empty: 'No diagnoses recorded.',
    fields: [
      { key: 'description', label: 'Description', type: 'text', required: true, max: 300 },
      { key: 'icd10Code', label: 'ICD-10 code', type: 'text', max: 16, mono: true, helper: 'Optional, e.g. K35.80' },
      { key: 'diagnosedOn', label: 'Diagnosed on', type: 'date' }
    ]
  }
];

interface FormState { list: MedicalList; id: number | null; values: Record<string, string>; errors: Record<string, string>; banner: string | null; saving: boolean }

@Component({
  selector: 'app-patient-medical',
  templateUrl: './patient-medical.component.html'
})
export class PatientMedicalComponent implements OnChanges, OnDestroy {
  @Input() patient!: Patient;
  @Input() medical!: PatientMedical;
  /** False while the tab is hidden: a revealed number is dropped as soon as the tab is left. */
  @Input() active = true;
  @Output() medicalChange = new EventEmitter<PatientMedical>();
  @Output() patientChange = new EventEmitter<Patient>();

  readonly lists = LISTS;
  readonly today = businessToday();
  /** Latest selectable date of birth: yesterday in the clinic's time zone. */
  readonly dobMax = addDays(businessToday(), -1);
  readonly humanize = humanize;
  readonly allergyChip = allergyChip;

  /* RAMQ */
  revealOpen = false;
  reason = '';
  revealBusy = false;
  revealError: string | null = null;
  /** The plain number. Lives only in this field: never in a URL, storage, the console or the title. */
  revealed: string | null = null;
  private revealTimer?: ReturnType<typeof setTimeout>;
  editHn = false;
  hnValue = '';
  hnBusy = false;
  hnError: string | null = null;
  removeHn = false;

  /* date of birth */
  editDob = false;
  dobValue = '';
  dobError: string | null = null;
  dobBusy = false;

  /* lists */
  form: FormState | null = null;
  removing: { list: MedicalList; id: number } | null = null;
  removeError: string | null = null;
  staff: Staff[] = [];
  surgeonOther = false;
  private staffLoaded = false;

  constructor(private files: PatientFileService, private staffService: StaffService, private host: ElementRef<HTMLElement>) {}

  private focusLater(selector: string): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus());
  }

  get age(): number | null {
    return ageOn(this.medical.dateOfBirth, this.today);
  }

  get dobText(): string {
    return this.medical.dateOfBirth ? fmtDayYear(this.medical.dateOfBirth + 'T12:00:00Z') : '—';
  }

  get hnValid(): boolean {
    return isValidRamq(this.hnValue);
  }

  get hnShowError(): boolean {
    return this.hnValue.trim().length > 0 && !this.hnValid;
  }

  get surgeons(): Staff[] {
    return this.staff.filter(s => s.active && (s.role === 'SURGEON' || s.role === 'PHYSICIAN'));
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['active'] && !this.active) {
      this.hideRevealed();
    }
    if (c['patient'] && !c['patient'].firstChange && c['patient'].previousValue?.id !== this.patient?.id) {
      this.hideRevealed();
    }
  }

  ngOnDestroy(): void {
    this.hideRevealed();
  }

  /* ---------- RAMQ ---------- */

  openReveal(): void {
    this.revealOpen = true;
    this.reason = '';
    this.revealError = null;
    setTimeout(() => (document.getElementById('reveal-reason') as HTMLElement | null)?.focus());
  }

  get reasonValid(): boolean {
    const n = this.reason.trim().length;
    return n >= 3 && n <= 200;
  }

  confirmReveal(): void {
    if (!this.reasonValid || this.revealBusy) {
      return;
    }
    this.revealBusy = true;
    this.revealError = null;
    this.files.revealHealthNumber(this.medical.patientId, this.reason.trim()).subscribe({
      next: r => {
        this.revealBusy = false;
        this.revealOpen = false;
        this.reason = '';
        this.revealed = r.healthNumber;
        clearTimeout(this.revealTimer);
        this.revealTimer = setTimeout(() => this.hideRevealed(), REVEAL_MS);
        this.focusLater('.hide-btn');
      },
      error: err => {
        this.revealBusy = false;
        this.revealError = err?.status === 404 ? 'No health number on file.' : 'Could not reveal the number.';
      }
    });
  }

  /** `restoreFocus`: the person pressed Hide, so the (now gone) button's focus goes to Reveal. */
  hideRevealed(restoreFocus = false): void {
    clearTimeout(this.revealTimer);
    this.revealed = null;
    if (restoreFocus) {
      this.focusLater('.reveal-btn');
    }
  }

  cancelReveal(): void {
    this.revealOpen = false;
    this.focusLater('.reveal-btn');
  }

  get revealedText(): string {
    return this.revealed ? formatRamq(this.revealed) : '';
  }

  openEditHn(): void {
    this.hideRevealed();
    this.editHn = true;
    this.hnValue = '';
    this.hnError = null;
    setTimeout(() => (document.getElementById('hn-input') as HTMLElement | null)?.focus());
  }

  saveHn(): void {
    if (!this.hnValid || this.hnBusy) {
      return;
    }
    this.hnBusy = true;
    this.hnError = null;
    this.files.setHealthNumber(this.medical.patientId, this.hnValue).subscribe({
      next: r => {
        this.hnBusy = false;
        this.editHn = false;
        this.hnValue = '';
        this.medicalChange.emit({ ...this.medical, healthNumberMasked: r.healthNumberMasked });
      },
      error: err => {
        this.hnBusy = false;
        this.hnError = apiErrorOf(err)?.fieldErrors['healthNumber'] ?? 'Could not save the health number.';
      }
    });
  }

  confirmRemoveHn(): void {
    this.hnBusy = true;
    this.files.clearHealthNumber(this.medical.patientId).subscribe({
      next: () => {
        this.hnBusy = false;
        this.removeHn = false;
        this.hideRevealed();
        this.medicalChange.emit({ ...this.medical, healthNumberMasked: null });
      },
      error: () => {
        this.hnBusy = false;
        this.hnError = 'Could not remove the health number.';
      }
    });
  }

  /* ---------- date of birth ---------- */

  openEditDob(): void {
    this.editDob = true;
    this.dobValue = this.medical.dateOfBirth ?? '';
    this.dobError = null;
  }

  saveDob(): void {
    this.dobBusy = true;
    this.dobError = null;
    this.files.updatePatient(this.medical.patientId, { ...this.patient, dateOfBirth: this.dobValue || null }).subscribe({
      next: p => {
        this.dobBusy = false;
        this.editDob = false;
        this.patientChange.emit(p);
        this.medicalChange.emit({ ...this.medical, dateOfBirth: p.dateOfBirth ?? null });
      },
      error: err => {
        this.dobBusy = false;
        this.dobError = apiErrorOf(err)?.fieldErrors['dateOfBirth'] ?? 'Could not save the date of birth.';
      }
    });
  }

  /* ---------- lists ---------- */

  cfg(key: MedicalList): ListCfg {
    return LISTS.find(l => l.key === key)!;
  }

  items(key: MedicalList): any[] {
    return this.medical[key] as any[];
  }

  rowName(key: MedicalList, i: any): string {
    return key === 'diagnoses' ? i.description : i.substance ?? i.name;
  }

  chipOf(i: any): ChipSpec {
    return allergyChip(i.severity);
  }

  openForm(list: MedicalList, item?: any): void {
    this.removing = null;
    const values: Record<string, string> = {};
    for (const f of this.cfg(list).fields) {
      values[f.key] = f.type === 'surgeon' ? '' : String(item?.[f.key] ?? (f.key === 'severity' ? 'UNKNOWN' : ''));
    }
    this.surgeonOther = false;
    if (list === 'procedures') {
      this.loadStaff();
      if (item?.surgeonStaffId) {
        values['surgeon'] = String(item.surgeonStaffId);
      } else if (item?.surgeonName) {
        values['surgeon'] = 'other';
        values['surgeonName'] = item.surgeonName;
        this.surgeonOther = true;
      }
    }
    this.form = { list, id: item?.id ?? null, values, errors: {}, banner: null, saving: false };
    setTimeout(() => (document.getElementById(`mf-${list}-${this.cfg(list).fields[0].key}`) as HTMLElement | null)?.focus());
  }

  private loadStaff(): void {
    if (this.staffLoaded) {
      return;
    }
    this.staffLoaded = true;
    this.staffService.list(false).subscribe({ next: s => (this.staff = s), error: () => (this.staffLoaded = false) });
  }

  onSurgeonChange(): void {
    this.surgeonOther = this.form?.values['surgeon'] === 'other';
  }

  closeForm(): void {
    this.form = null;
  }

  canSave(): boolean {
    const f = this.form;
    return !!f && !f.saving && this.cfg(f.list).fields.every(d => !d.required || (f.values[d.key] ?? '').trim() !== '');
  }

  private request(f: FormState): any {
    const v = (k: string) => (f.values[k] ?? '').trim();
    const opt = (k: string) => v(k) || null;
    switch (f.list) {
      case 'allergies': return { substance: v('substance'), severity: v('severity'), reaction: opt('reaction') };
      case 'medications': return { name: v('name'), dose: opt('dose'), frequency: opt('frequency'), startDate: opt('startDate') };
      case 'procedures': {
        const s = v('surgeon');
        const staffId = s && s !== 'other' ? Number(s) : null;
        return { name: v('name'), performedOn: v('performedOn'), surgeonStaffId: staffId, surgeonName: s === 'other' ? opt('surgeonName') : null };
      }
      default: return { description: v('description'), icd10Code: opt('icd10Code'), diagnosedOn: opt('diagnosedOn') };
    }
  }

  save(): void {
    const f = this.form;
    if (!f || !this.canSave()) {
      return;
    }
    f.saving = true;
    f.errors = {};
    f.banner = null;
    const req = this.request(f);
    const call = f.id === null ? this.files.addItem(this.medical.patientId, f.list, req) : this.files.updateItem(this.medical.patientId, f.list, f.id, req);
    (call as any).subscribe({
      next: (saved: any) => {
        const current = this.items(f.list);
        const next = f.id === null ? [...current, saved] : current.map(x => (x.id === saved.id ? saved : x));
        this.form = null;
        this.medicalChange.emit({ ...this.medical, [f.list]: next });
      },
      error: (err: unknown) => {
        f.saving = false;
        const api: ApiError | null = apiErrorOf(err);
        if (api && Object.keys(api.fieldErrors).length) {
          f.errors = { ...api.fieldErrors };
          if (api.fieldErrors['surgeonStaffId'] || api.fieldErrors['surgeonName']) {
            f.errors['surgeon'] = api.fieldErrors['surgeonStaffId'] ?? api.fieldErrors['surgeonName'];
          }
        } else {
          f.banner = api?.error === 'STAFF_INACTIVE' ? api.message : 'Could not save. Try again.';
        }
      }
    });
  }

  askRemove(list: MedicalList, id: number): void {
    this.form = null;
    this.removeError = null;
    this.removing = { list, id };
  }

  confirmRemove(): void {
    const r = this.removing;
    if (!r) {
      return;
    }
    this.files.removeItem(this.medical.patientId, r.list, r.id).subscribe({
      next: () => {
        this.removing = null;
        this.medicalChange.emit({ ...this.medical, [r.list]: this.items(r.list).filter(x => x.id !== r.id) });
      },
      error: () => (this.removeError = 'Could not remove the item.')
    });
  }

  onMenu(list: MedicalList, item: any, key: string): void {
    if (key === 'edit') {
      this.openForm(list, item);
    } else {
      this.askRemove(list, item.id);
    }
  }
}
