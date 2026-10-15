import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlertCountService } from '../../Services/AlertCount.service';
import { SettingsService } from '../../Services/Settings.service';
import { apiErrorOf } from '../../models/api-error.model';
import { AlertSeverity } from '../../models/alert.model';
import { ClinicSettings, ClinicSettingsRequest, Language } from '../../models/settings.model';

export type SettingsTab = 'clinic' | 'staff' | 'notifications' | 'rules';
export const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: 'clinic', label: 'Clinic' }, { key: 'staff', label: 'Staff' }, { key: 'notifications', label: 'Notifications' }, { key: 'rules', label: 'Alert rules' }
];

interface ClinicForm { name: string; addressLine: string; city: string; province: string; postalCode: string; phone: string; defaultLanguage: Language }

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit, OnDestroy {
  readonly tabs = SETTINGS_TABS;
  tab: SettingsTab = 'clinic';
  current: ClinicSettings | null = null;
  form: ClinicForm = { name: '', addressLine: '', city: '', province: 'QC', postalCode: '', phone: '', defaultLanguage: 'FR' };
  loadError = false;
  saving = false;
  saved = false;
  errors: Record<string, string> = {};
  banner: string | null = null;
  notifyError: string | null = null;
  notifyBusy = false;

  @ViewChildren('tabBtn') tabButtons?: QueryList<ElementRef<HTMLButtonElement>>;
  private sub = new Subscription();
  private formTouched = false;

  constructor(private settings: SettingsService, private alertCount: AlertCountService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap?.get('tab') as SettingsTab | null;
    if (t && SETTINGS_TABS.some(x => x.key === t)) {
      this.tab = t;
    }
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  loadSettings(): void {
    this.loadError = false;
    this.sub.add(this.settings.clinic$.subscribe({
      next: c => {
        this.current = c;
        if (!this.formTouched) {
          this.form = {
            name: c.name, addressLine: c.addressLine ?? '', city: c.city ?? '', province: c.province, postalCode: c.postalCode ?? '',
            phone: c.phone ?? '', defaultLanguage: c.defaultLanguage
          };
        }
      },
      error: () => (this.loadError = true)
    }));
  }

  /* ---------- tabs ---------- */

  selectTab(t: SettingsTab, focus = false): void {
    this.tab = t;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t === 'clinic' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true });
    if (focus) {
      setTimeout(() => this.tabButtons?.get(SETTINGS_TABS.findIndex(x => x.key === t))?.nativeElement.focus());
    }
  }

  onTabKey(e: KeyboardEvent): void {
    const i = SETTINGS_TABS.findIndex(x => x.key === this.tab);
    const n = SETTINGS_TABS.length;
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next >= 0) {
      e.preventDefault();
      this.selectTab(SETTINGS_TABS[next].key, true);
    }
  }

  /* ---------- clinic profile ---------- */

  touch(): void {
    this.formTouched = true;
    this.saved = false;
  }

  upperProvince(): void {
    this.form.province = this.form.province.trim().toUpperCase();
  }

  private request(severities: AlertSeverity[]): ClinicSettingsRequest {
    const f = this.form;
    const opt = (v: string) => v.trim() || null;
    return {
      name: f.name.trim(), addressLine: opt(f.addressLine), city: opt(f.city), province: f.province.trim().toUpperCase(),
      postalCode: opt(f.postalCode), phone: opt(f.phone), defaultLanguage: f.defaultLanguage, notifySeverities: severities
    };
  }

  saveClinic(): void {
    if (!this.current || this.saving) {
      return;
    }
    this.saving = true;
    this.saved = false;
    this.errors = {};
    this.banner = null;
    this.settings.update(this.request(this.current.notifySeverities)).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        this.formTouched = false;
      },
      error: err => {
        this.saving = false;
        const api = apiErrorOf(err);
        if (api && Object.keys(api.fieldErrors).length) {
          this.errors = { ...api.fieldErrors };
        } else {
          this.banner = 'Could not save the settings.';
        }
      }
    });
  }

  /* ---------- notifications ---------- */

  notifies(s: AlertSeverity): boolean {
    return !!this.current?.notifySeverities.includes(s);
  }

  /** Saves immediately with the full current settings (server values, not unsaved profile edits). */
  toggle(s: AlertSeverity, on: boolean, box?: HTMLInputElement): void {
    const c = this.current;
    if (!c || this.notifyBusy) {
      return;
    }
    const order: AlertSeverity[] = ['HIGH', 'MEDIUM'];
    const next = order.filter(x => (x === s ? on : c.notifySeverities.includes(x)));
    this.notifyBusy = true;
    this.notifyError = null;
    const body: ClinicSettingsRequest = {
      name: c.name, addressLine: c.addressLine, city: c.city, province: c.province, postalCode: c.postalCode, phone: c.phone,
      defaultLanguage: c.defaultLanguage, notifySeverities: next
    };
    this.settings.update(body).subscribe({
      next: () => {
        this.notifyBusy = false;
        this.alertCount.refresh();
      },
      error: () => {
        this.notifyBusy = false;
        this.notifyError = 'Could not save the notification settings.';
        if (box) {
          box.checked = !on; // put the checkbox back: nothing was saved
        }
      }
    });
  }
}
