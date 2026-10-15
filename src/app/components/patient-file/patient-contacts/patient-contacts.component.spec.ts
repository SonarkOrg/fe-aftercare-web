import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { CLINIC, careTeamMember, contact, staffMember } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { PatientContactsComponent } from './patient-contacts.component';

describe('PatientContactsComponent', () => {
  let fixture: ComponentFixture<PatientContactsComponent>;
  let component: PatientContactsComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const base = `${environment.apiUrl}/patients/5`;
  const staff = [
    staffMember({ id: 1, displayName: 'Marie Nurse' }),
    staffMember({ id: 2, displayName: 'Sam Doc', role: 'PHYSICIAN' }),
    staffMember({ id: 3, displayName: 'Gone Away', active: false })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientContactsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientContactsComponent);
    component = fixture.componentInstance;
    component.patientId = 5;
    el = fixture.nativeElement;
    // the parent keeps the care team: take the emitted value back
    component.careTeamChange.subscribe(c => (component.careTeam = c));
  });
  afterEach(() => http.verify());

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  async function init(contacts: unknown[] = [contact()], team = [careTeamMember()], staffList: unknown[] = staff, clinic: object = CLINIC) {
    component.careTeam = team;
    fixture.detectChanges();
    http.expectOne(`${base}/emergency-contacts`).flush(contacts);
    http.expectOne(x => x.url === `${environment.apiUrl}/staff`).flush(staffList);
    http.expectOne(`${environment.apiUrl}/settings/clinic`).flush(clinic);
    await settle();
  }
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const type = async (sel: string, value: string, event = 'input') => {
    const i = q<HTMLInputElement>(sel);
    i.value = value;
    i.dispatchEvent(new Event(event));
    await settle();
  };

  it('lists contacts with a tel: link and the language chip, and the care team with roles', async () => {
    await init([contact(), contact({ id: 8, name: 'Anne Roy', preferredLanguage: 'FR' })], [careTeamMember(), careTeamMember({ assignmentId: 10, staffId: 2, displayName: 'Sam Doc', role: 'PHYSICIAN', active: false })]);
    const rows = el.querySelectorAll('.contacts-card .row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.row__name')!.textContent).toBe('John Doe');
    expect(rows[0].querySelector('.row__sub a')!.getAttribute('href')).toBe('tel:514-555-0111');
    expect(rows[0].querySelector('.row__sub')!.textContent).toContain('Spouse');
    expect(rows[0].querySelector('.chip--neutral .chip__label')!.textContent).toBe('EN');
    expect(rows[1].querySelector('.chip__label')!.textContent).toBe('FR');
    const team = el.querySelectorAll('.care-team-card .rows .row');
    expect(team.length).toBe(2);
    expect(team[1].querySelector('.row__sub')!.textContent).toBe('Physician');
    expect(team[1].querySelector('.chip--neutral')!.textContent).toContain('Inactive');
  });

  it('shows the empty states', async () => {
    await init([], []);
    expect(el.textContent).toContain('No emergency contacts.');
    expect(el.textContent).toContain('No care team assigned.');
  });

  it('adds a contact; the language defaults to the clinic default; the phone is sent as typed', async () => {
    await init([]);
    q<HTMLButtonElement>('.add-contact').click();
    await settle();
    expect(q<HTMLSelectElement>('#ec-lang').value).toBe('FR');
    await type('#ec-name', 'Marc Roy');
    await type('#ec-rel', 'Brother');
    await type('#ec-phone', '514-555-0199');
    await type('#ec-lang', 'EN', 'change');
    q<HTMLButtonElement>('.save-contact').click();
    const r = http.expectOne(`${base}/emergency-contacts`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ name: 'Marc Roy', relationship: 'Brother', phone: '514-555-0199', preferredLanguage: 'EN' });
    r.flush(contact({ id: 9, name: 'Marc Roy' }), { status: 201, statusText: 'Created' });
    await settle();
    expect(el.querySelectorAll('.contacts-card .row').length).toBe(1);
    expect(el.querySelector('.contact-form')).toBeNull();
  });

  it('shows server field errors under their inputs', async () => {
    await init([]);
    q<HTMLButtonElement>('.add-contact').click();
    await settle();
    await type('#ec-name', 'Marc');
    await type('#ec-rel', 'Brother');
    await type('#ec-phone', 'abc');
    q<HTMLButtonElement>('.save-contact').click();
    http.expectOne(`${base}/emergency-contacts`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { phone: 'must be a valid phone number' } }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('#ec-phone').parentElement!.querySelector('.field-error')!.textContent).toBe('must be a valid phone number');
  });

  it('edits through the menu with PUT, and removes after a confirmation with DELETE', async () => {
    await init();
    q<HTMLElement>('.contacts-card app-row-menu .more-btn').click();
    await settle();
    q<HTMLElement>('.row-menu__item[data-key=edit]').click();
    await settle();
    expect(q<HTMLInputElement>('#ec-name').value).toBe('John Doe');
    await type('#ec-phone', '514-555-0000');
    q<HTMLButtonElement>('.save-contact').click();
    const put = http.expectOne(`${base}/emergency-contacts/7`);
    expect(put.request.method).toBe('PUT');
    put.flush(contact({ phone: '514-555-0000' }));
    await settle();
    expect(q('.contacts-card .row__sub a').textContent).toBe('514-555-0000');
    q<HTMLElement>('.contacts-card app-row-menu .more-btn').click();
    await settle();
    q<HTMLElement>('.row-menu__item[data-key=remove]').click();
    await settle();
    q<HTMLButtonElement>('.contacts-card .confirm-inline__ok').click();
    const del = http.expectOne(`${base}/emergency-contacts/7`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(el.querySelectorAll('.contacts-card .row').length).toBe(0);
  });

  it('assigns an active staff member not yet on the team, with the directory role by default', async () => {
    await init([], [careTeamMember()]);
    const options = Array.from(el.querySelectorAll('#assign-staff option')).map(o => o.textContent!.trim());
    expect(options).toEqual(['Choose…', 'Sam Doc — Physician']); // Marie is assigned, Gone Away is inactive
    expect(q<HTMLButtonElement>('.assign-btn').disabled).toBeTrue();
    await type('#assign-staff', '2', 'change');
    expect(q<HTMLSelectElement>('#assign-role').value).toBe('');
    q<HTMLButtonElement>('.assign-btn').click();
    const r = http.expectOne(`${base}/care-team`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ staffId: 2, role: null });
    r.flush(careTeamMember({ assignmentId: 11, staffId: 2, displayName: 'Sam Doc', role: 'PHYSICIAN' }), { status: 201, statusText: 'Created' });
    await settle();
    expect(Array.from(el.querySelectorAll('.care-team-card .rows .row__name')).map(n => n.textContent)).toEqual(['Marie Nurse', 'Sam Doc']); // role enum order: nurse before physician
  });

  it('sends an explicit role and shows ALREADY_ASSIGNED', async () => {
    await init([], []);
    await type('#assign-staff', '1', 'change');
    await type('#assign-role', 'NURSE_PRACTITIONER', 'change');
    q<HTMLButtonElement>('.assign-btn').click();
    http.expectOne(`${base}/care-team`).flush({ status: 409, error: 'ALREADY_ASSIGNED', message: 'Staff member is already on the care team', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(q('.assign .banner--error').textContent).toContain('Staff member is already on the care team');
  });

  it('removes a team member after a confirmation', async () => {
    await init([], [careTeamMember()]);
    q<HTMLElement>('.care-team-card app-row-menu .more-btn').click();
    await settle();
    q<HTMLElement>('.row-menu__item[data-key=remove]').click();
    await settle();
    q<HTMLButtonElement>('.care-team-card .confirm-inline__ok').click();
    const del = http.expectOne(`${base}/care-team/9`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    expect(el.textContent).toContain('No care team assigned.');
  });

  it('offers "Add staff in Settings" when the directory is empty', async () => {
    await init([], [], []);
    const link = q<HTMLAnchorElement>('.care-team-card .empty a');
    expect(link.textContent).toBe('Add staff in Settings');
    expect(link.getAttribute('href')).toBe('/settings?tab=staff');
  });
});
