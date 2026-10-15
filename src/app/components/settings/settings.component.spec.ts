import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AlertCountService } from '../../Services/AlertCount.service';
import { CLINIC, FULL_Q, SEED_RULES, staffMember } from '../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { AlertRulesComponent } from './alert-rules/alert-rules.component';
import { SettingsComponent } from './settings.component';
import { StaffDirectoryComponent } from './staff-directory/staff-directory.component';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let http: HttpTestingController;
  let alertRefresh: jasmine.Spy;
  let el: HTMLElement;
  const api = environment.apiUrl;
  const staff = [
    staffMember({ id: 1, displayName: 'Marie Nurse', auth0Subject: 'auth0|abc' }),
    staffMember({ id: 2, displayName: 'Sam Doc', role: 'PHYSICIAN', email: null }),
    staffMember({ id: 3, displayName: 'Old Timer', active: false })
  ];

  beforeEach(async () => {
    alertRefresh = jasmine.createSpy('refresh');
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [SettingsComponent, StaffDirectoryComponent, AlertRulesComponent, ...SHARED_DECLARATIONS],
      providers: [{ provide: AlertCountService, useValue: { refresh: alertRefresh } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });
  afterEach(() => {
    http.verify();
    document.body.classList.remove('drawer-open');
  });

  /** ngModel connects its controls (and writes values / disabled) in a microtask: wait for it, then render. */
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  async function init(clinic: object = CLINIC, list: object = staff) {
    await settle();
    http.expectOne(`${api}/settings/clinic`).flush(clinic);
    const s = http.expectOne(r => r.url === `${api}/staff`);
    expect(s.request.params.get('includeInactive')).toBe('true');
    s.flush(list);
    await settle();
  }
  const type = async (sel: string, value: string, event = 'input') => {
    const i = q<HTMLInputElement>(sel);
    i.value = value;
    i.dispatchEvent(new Event(event));
    await settle();
  };
  const staffRows = () => Array.from(el.querySelectorAll('.staff-row')).map(r => r.querySelector('.row__name')!.textContent!.trim());

  it('has the title, the clinic name as subtitle and the four tabs', async () => {
    await init();
    expect(q('h1').textContent).toBe('Settings');
    expect(q('.hero__sub').textContent).toBe('Clinique Test');
    expect(Array.from(el.querySelectorAll('.tabs .tab')).map(t => t.textContent!.trim())).toEqual(['Clinic', 'Staff', 'Notifications', 'Alert rules']);
    expect(el.querySelector('.tabs .tab[aria-selected=true]')!.textContent).toBe('Clinic');
  });

  it('arrow keys move between the tabs', async () => {
    await init();
    q('.tabs').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(component.tab).toBe('staff');
    q('.tabs').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(component.tab).toBe('clinic');
  });

  describe('clinic profile', () => {
    it('fills the form from the settings', async () => {
      await init();
      expect(q<HTMLInputElement>('#c-name').value).toBe('Clinique Test');
      expect(q<HTMLInputElement>('#c-city').value).toBe('Montréal');
      expect(q<HTMLInputElement>('#c-province').value).toBe('QC');
      expect(q<HTMLSelectElement>('#c-lang').value).toBe('FR');
      expect(q('label[for=c-lang]').textContent).toBe('Default language for patient contacts');
    });

    it('saves the full body (blank optional fields as null, province upper-cased) and confirms with a status banner', async () => {
      await init();
      await type('#c-name', 'Clinique Nord');
      await type('#c-address', '');
      await type('#c-province', 'on');
      q<HTMLInputElement>('#c-province').dispatchEvent(new Event('blur'));
      await settle();
      expect(q<HTMLInputElement>('#c-province').value).toBe('ON');
      await type('#c-lang', 'EN', 'change');
      q<HTMLButtonElement>('.save-clinic').click();
      const r = http.expectOne(`${api}/settings/clinic`);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body).toEqual({
        name: 'Clinique Nord', addressLine: null, city: 'Montréal', province: 'ON', postalCode: 'H2X 1Y4', phone: '514-555-0100',
        defaultLanguage: 'EN', notifySeverities: ['HIGH', 'MEDIUM']
      });
      r.flush({ ...CLINIC, name: 'Clinique Nord', updatedAt: '2026-10-15T14:00:00Z', updatedByName: 'Dev Nurse' });
      await settle();
      const saved = q('.banner--info[role=status]');
      expect(saved.textContent).toContain('Saved.');
      expect(q('.hero__sub').textContent).toBe('Clinique Nord');
    });

    it('maps field errors under their inputs', async () => {
      await init();
      q<HTMLButtonElement>('.save-clinic').click();
      http.expectOne(`${api}/settings/clinic`).flush(
        { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { postalCode: 'must be a valid postal code', province: 'must be 2 letters' } }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(q('#c-postal').parentElement!.querySelector('.field-error')!.textContent).toBe('must be a valid postal code');
      expect(q('#c-province').parentElement!.querySelector('.field-error')!.textContent).toBe('must be 2 letters');
      expect(el.querySelector('.banner--info[role=status]')).toBeNull();
    });
  });

  describe('notifications', () => {
    it('shows both severities with glyph and word, reflecting the saved choice', async () => {
      await init({ ...CLINIC, notifySeverities: ['HIGH'] });
      expect(q('#spanel-notifications').textContent).toContain('Choose which open alerts count toward the Alerts badge and bell in the top bar. No email or SMS is sent.');
      expect(q('label[for=n-high]').textContent!.trim()).toBe('▲ High alerts');
      expect(q('label[for=n-medium]').textContent!.trim()).toBe('● Medium alerts');
      expect(q<HTMLInputElement>('#n-high').checked).toBeTrue();
      expect(q<HTMLInputElement>('#n-medium').checked).toBeFalse();
    });

    it('a toggle saves immediately with the full current settings, then refreshes the alert count', async () => {
      await init();
      q<HTMLInputElement>('#n-medium').click();
      const r = http.expectOne(`${api}/settings/clinic`);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body).toEqual({
        name: 'Clinique Test', addressLine: '1 rue Principale', city: 'Montréal', province: 'QC', postalCode: 'H2X 1Y4', phone: '514-555-0100',
        defaultLanguage: 'FR', notifySeverities: ['HIGH']
      });
      expect(alertRefresh).not.toHaveBeenCalled();
      r.flush({ ...CLINIC, notifySeverities: ['HIGH'] });
      expect(alertRefresh).toHaveBeenCalledTimes(1);
      await settle();
      expect(q<HTMLInputElement>('#n-high').checked).toBeTrue();
      expect(q<HTMLInputElement>('#n-medium').checked).toBeFalse();
      // and back on: enum order is kept
      q<HTMLInputElement>('#n-medium').click();
      const again = http.expectOne(`${api}/settings/clinic`);
      expect(again.request.body.notifySeverities).toEqual(['HIGH', 'MEDIUM']);
      again.flush(CLINIC);
    });

    it('can turn everything off (an empty list is valid)', async () => {
      await init({ ...CLINIC, notifySeverities: ['HIGH'] });
      q<HTMLInputElement>('#n-high').click();
      const r = http.expectOne(`${api}/settings/clinic`);
      expect(r.request.body.notifySeverities).toEqual([]);
      r.flush({ ...CLINIC, notifySeverities: [] });
    });

    it('a failed save puts the checkbox back and says so, without refreshing the count', async () => {
      await init();
      q<HTMLInputElement>('#n-medium').click();
      http.expectOne(`${api}/settings/clinic`).flush('x', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(q<HTMLInputElement>('#n-medium').checked).toBeTrue();
      expect(q('#spanel-notifications .banner--error').textContent).toContain('Could not save the notification settings.');
      expect(alertRefresh).not.toHaveBeenCalled();
    });
  });

  describe('staff directory', () => {
    it('lists active staff by default with role, email, a linked chip and counts on the filters', async () => {
      await init();
      expect(staffRows()).toEqual(['Marie Nurse', 'Sam Doc']);
      const first = q('.staff-row');
      expect(first.querySelector('.row__sub')!.textContent).toBe('Nurse · marie@example.com');
      expect(first.querySelector('.chip--info .chip__label')!.textContent).toBe('Linked');
      expect(first.querySelector('.chip--info .chip__glyph')!.textContent).toBe('ℹ');
      const second = el.querySelectorAll('.staff-row')[1];
      expect(second.querySelector('.row__sub')!.textContent).toBe('Physician · no email');
      expect(second.querySelector('.chip--neutral .chip__label')!.textContent).toBe('Not linked');
      expect(Array.from(el.querySelectorAll('.staff-filter .pill-group__item')).map(p => p.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Active 2', 'Inactive 1', 'All 3']);
      expect(q('.staff-card .badge').textContent).toBe('3');
    });

    it('the Inactive and All filters work client-side and show an Inactive chip', async () => {
      await init();
      const pills = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.staff-filter .pill-group__item'));
      pills()[1].click();
      await settle();
      expect(staffRows()).toEqual(['Old Timer']);
      expect(q('.staff-row').textContent).toContain('Inactive');
      pills()[2].click();
      await settle();
      expect(staffRows()).toEqual(['Marie Nurse', 'Sam Doc', 'Old Timer']);
    });

    it('Add staff opens the drawer; creating sends the blank email and subject as null and adds the row', async () => {
      await init();
      q<HTMLButtonElement>('.add-staff').click();
      await settle();
      expect(q('.drawer #staff-drawer-title').textContent).toBe('Add staff');
      expect(q('#st-sub').classList).toContain('mono');
      expect(q('#st-sub-h').textContent).toContain('Optional. Links this person to their login (e.g. auth0|64f…). Their name then appears on notes and messages.');
      expect(q<HTMLButtonElement>('.save-staff').disabled).toBeTrue();
      await type('#st-name', 'Alex Aide');
      await type('#st-role', 'ADMINISTRATIVE', 'change');
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      const r = http.expectOne(`${api}/staff`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ displayName: 'Alex Aide', email: null, role: 'ADMINISTRATIVE', auth0Subject: null });
      r.flush(staffMember({ id: 9, displayName: 'Alex Aide', role: 'ADMINISTRATIVE', email: null }), { status: 201, statusText: 'Created' });
      await settle();
      expect(el.querySelector('.drawer')).toBeNull();
      expect(staffRows()).toEqual(['Alex Aide', 'Marie Nurse', 'Sam Doc']);
    });

    it('a 409 DUPLICATE_STAFF shows a banner in the drawer and keeps it open', async () => {
      await init();
      q<HTMLButtonElement>('.add-staff').click();
      await settle();
      await type('#st-name', 'Marie Nurse');
      await type('#st-email', 'marie@example.com');
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      http.expectOne(`${api}/staff`).flush(
        { status: 409, error: 'DUPLICATE_STAFF', message: 'A staff member with this email or login already exists', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(q('.drawer .banner--error').textContent).toContain('A staff member with this email or login already exists');
      expect(q<HTMLButtonElement>('.save-staff').disabled).toBeFalse();
    });

    it('Edit pre-fills the drawer and PUTs', async () => {
      await init();
      q<HTMLElement>('.staff-row app-row-menu .more-btn').click();
      await settle();
      q<HTMLElement>('.row-menu__item[data-key=edit]').click();
      await settle();
      expect(q('.drawer #staff-drawer-title').textContent).toBe('Edit staff');
      expect(q<HTMLInputElement>('#st-name').value).toBe('Marie Nurse');
      expect(q<HTMLInputElement>('#st-sub').value).toBe('auth0|abc');
      await type('#st-name', 'Marie N.');
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      const r = http.expectOne(`${api}/staff/1`);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body).toEqual({ displayName: 'Marie N.', email: 'marie@example.com', role: 'NURSE', auth0Subject: 'auth0|abc' });
      r.flush({ ...staff[0], displayName: 'Marie N.' });
      await settle();
      expect(staffRows()).toContain('Marie N.');
    });

    it('closing a drawer opened from a row menu returns focus to that row\'s menu button (Esc, and after saving)', async () => {
      document.body.appendChild(el);
      await init();
      component.selectTab('staff');
      await settle();
      const menuBtn = () => el.querySelectorAll<HTMLElement>('.staff-row app-row-menu .more-btn')[1];
      menuBtn().click();
      await settle();
      q<HTMLElement>('.row-menu__item[data-key=edit]').click();
      await settle();
      expect(q('.drawer #staff-drawer-title').textContent).toBe('Edit staff');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(document.activeElement).toBe(menuBtn());
      expect(menuBtn().getAttribute('aria-label')).toBe('Actions for Sam Doc');

      menuBtn().click();
      await settle();
      q<HTMLElement>('.row-menu__item[data-key=edit]').click();
      await settle();
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      http.expectOne(`${api}/staff/2`).flush({ ...staff[1], displayName: 'Sam D.' });
      await settle();
      expect(document.activeElement).toBe(menuBtn());
      el.remove();
    });

    it('Esc closes the drawer', async () => {
      await init();
      q<HTMLButtonElement>('.add-staff').click();
      await settle();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(el.querySelector('.drawer')).toBeNull();
      expect(document.body.classList).not.toContain('drawer-open');
    });

    it('Deactivate moves the row under the Inactive filter; Reactivate brings it back', async () => {
      await init();
      q<HTMLElement>('.staff-row app-row-menu .more-btn').click();
      await settle();
      q<HTMLElement>('.row-menu__item[data-key=deactivate]').click();
      const r = http.expectOne(`${api}/staff/1/deactivate`);
      expect(r.request.method).toBe('POST');
      r.flush({ ...staff[0], active: false });
      await settle();
      expect(staffRows()).toEqual(['Sam Doc']);
      el.querySelectorAll<HTMLButtonElement>('.staff-filter .pill-group__item')[1].click();
      await settle();
      expect(staffRows()).toEqual(['Marie Nurse', 'Old Timer']);
      q<HTMLElement>('.staff-row app-row-menu .more-btn').click();
      await settle();
      q<HTMLElement>('.row-menu__item[data-key=reactivate]').click();
      http.expectOne(`${api}/staff/1/reactivate`).flush({ ...staff[0], active: true });
      await settle();
      expect(staffRows()).toEqual(['Old Timer']);
    });
  });

  describe('alert rules', () => {
    const def = (id: number, status = 'ACTIVE') => ({
      id, url: 'https://aftercare.example/fhir/Questionnaire/followup', version: '1', title: { fr: 'Suivi', en: 'Follow-up check-in' }, purpose: 'FOLLOW_UP_CHECKIN',
      specialty: 'VISCERAL_SURGERY', appointmentTypes: [], status, loadedAt: '2026-10-01T00:00:00Z'
    });
    const rules = [
      ...SEED_RULES,
      { linkId: 'MOBILITY', operator: 'in', value: ['bedbound', 'unaided'], outcome: { type: 'NEEDS_REVIEW', message: { fr: 'x', en: 'Needs a look' } } },
      { linkId: 'TEMPERATURE', operator: '<=', value: 35, outcome: { type: 'ALERT', severity: 'MEDIUM', message: { fr: 'x', en: 'Cold' } } },
      { linkId: 'FEVER', operator: 'equals-false', outcome: { type: 'ALERT', severity: 'MEDIUM', message: { fr: 'x', en: 'No fever' } } }
    ];

    async function openRules() {
      await init();
      component.selectTab('rules');
      await settle();
      http.expectOne(`${api}/questionnaires`).flush([def(7), def(8, 'RETIRED')]);
      http.expectOne(`${api}/questionnaires/7`).flush({ ...def(7), questionnaire: FULL_Q, rules });
      await settle();
    }
    const tableRows = () => Array.from(el.querySelectorAll('.rules-card tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td.querySelector('.chip__label') ?? td).textContent!.replace(/\s+/g, ' ').trim()));

    it('is not loaded until its tab is opened, and loads only the ACTIVE definitions', async () => {
      await init();
      http.expectNone(`${api}/questionnaires`);
      component.selectTab('rules');
      await settle();
      http.expectOne(`${api}/questionnaires`).flush([def(7), def(8, 'RETIRED')]);
      http.expectOne(`${api}/questionnaires/7`).flush({ ...def(7), questionnaire: FULL_Q, rules });
      http.expectNone(`${api}/questionnaires/8`);
      await settle();
      expect(el.querySelectorAll('.rules-card').length).toBe(1);
    });

    it('renders one card per definition: title, url|version, purpose chip and the footer', async () => {
      await openRules();
      const card = q('.rules-card');
      expect(card.querySelector('.card__title--sm')!.textContent).toBe('Follow-up check-in');
      expect(card.querySelector('.mono')!.textContent).toBe('https://aftercare.example/fhir/Questionnaire/followup|1');
      expect(card.querySelector('.chip--neutral .chip__label')!.textContent).toBe('Follow up checkin');
      expect(q('#spanel-rules .helper-line').textContent).toContain('Rules are read-only here. To change one, publish a new form version (see API README → Forms). A clinician must validate thresholds.');
    });

    it('renders conditions ("≥ 7", "= Yes", answer names), outcome chips and messages in English', async () => {
      await openRules();
      const rows = tableRows();
      expect(rows[0]).toEqual(['Pain level?', '≥ 5', 'Alert · Medium', 'x']);
      expect(rows[1]).toEqual(['Pain level?', '≥ 7', 'Alert · High', 'x']);
      expect(rows[4]).toEqual(['Do you have a fever?', '= Yes', 'Alert · High', 'x']);
      expect(rows[5]).toEqual(['Mobility?', 'Bedbound, Unaided', 'Needs review', 'Needs a look']);
      expect(rows[6][1]).toBe('≤ 35');
      expect(rows[7]).toEqual(['Do you have a fever?', '= No', 'Alert · Medium', 'No fever']);
      const chip = el.querySelectorAll('.rules-card tbody tr')[1].querySelector('.chip--critical')!;
      expect(chip.querySelector('.chip__glyph')!.textContent).toBe('▲');
      expect(el.querySelectorAll('.rules-card tbody tr')[5].querySelector('.chip--serious .chip__glyph')!.textContent).toBe('◆');
    });

    it('is read-only: no inputs inside the rules', async () => {
      await openRules();
      expect(el.querySelector('#spanel-rules input, #spanel-rules textarea, #spanel-rules select')).toBeNull();
    });

    it('shows a retry when the definitions fail to load', async () => {
      await init();
      component.selectTab('rules');
      await settle();
      http.expectOne(`${api}/questionnaires`).flush('x', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(q('#spanel-rules .banner--error').textContent).toContain('Could not load the alert rules');
    });
  });
});
