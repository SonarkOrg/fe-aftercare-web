import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Permissions } from '../../../auth/permissions.service';
import { me, providePermissions, staffMember } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { StaffDirectoryComponent } from './staff-directory.component';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';

describe('StaffDirectoryComponent (access roles)', () => {
  const api = environment.apiUrl;
  let fixture: ComponentFixture<StaffDirectoryComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const staff = [
    staffMember({ id: 6, displayName: 'Dev Admin', accessRole: 'ADMIN', role: 'OTHER', auth0Subject: 'dev|admin-1' }),
    staffMember({ id: 1, displayName: 'Marie Nurse', accessRole: 'NURSE', auth0Subject: 'auth0|abc' }),
    staffMember({ id: 2, displayName: 'Sam Doc', accessRole: 'PHYSICIAN', role: 'PHYSICIAN' }),
    staffMember({ id: 3, displayName: 'Rita Desk', accessRole: 'RECEPTION', role: 'ADMINISTRATIVE' })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [StaffDirectoryComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('ADMIN')]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StaffDirectoryComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => {
    http.verify();
    document.body.classList.remove('drawer-open');
  });

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  async function init(list: object[] = staff) {
    await settle();
    http.expectOne(r => r.url === `${api}/staff`).flush(list);
    await settle();
  }
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const rows = () => Array.from(el.querySelectorAll('.staff-row'));
  const names = () => rows().map(r => r.querySelector('.row__name')!.textContent!.trim());
  const rowOf = (name: string) => rows().find(r => r.querySelector('.row__name')!.textContent!.trim() === name)!;
  const openMenu = async (name: string, key: string) => {
    rowOf(name).querySelector<HTMLButtonElement>('.more-btn')!.click();
    await settle();
    q<HTMLElement>(`.row-menu__item[data-key=${key}]`).click();
    await settle();
  };
  const choose = async (sel: string, value: string) => {
    const c = q<HTMLSelectElement>(sel);
    c.value = value;
    c.dispatchEvent(new Event('change'));
    await settle();
  };

  it('shows a role badge on each row, beside the profession in the sub line', async () => {
    await init();
    const badge = (n: string) => rowOf(n).querySelector('app-role-badge .chip')!;
    expect(badge('Dev Admin').textContent).toContain('Admin');
    expect(badge('Dev Admin').getAttribute('aria-label')).toBe('Access role: Admin');
    expect(badge('Marie Nurse').textContent).toContain('Nurse');
    expect(badge('Sam Doc').textContent).toContain('Physician');
    expect(badge('Rita Desk').textContent).toContain('Reception');
    expect(rowOf('Rita Desk').querySelector('.row__sub')!.textContent).toContain('Administrative');
  });

  it('filters by access role, client-side', async () => {
    await init();
    const select = q<HTMLSelectElement>('#staff-role-filter');
    expect(Array.from(select.options).map(o => o.textContent!.trim())).toEqual(['All roles', 'Admin', 'Physician', 'Nurse', 'Reception']);
    await choose('#staff-role-filter', 'RECEPTION');
    expect(names()).toEqual(['Rita Desk']);
    await choose('#staff-role-filter', 'NURSE');
    expect(names()).toEqual(['Marie Nurse']);
    await choose('#staff-role-filter', 'all');
    expect(names().length).toBe(4);
    http.expectNone(r => r.url === `${api}/staff`);
  });

  describe('drawer', () => {
    it('labels the old Role field "Profession" and adds a required Access select with help', async () => {
      await init();
      q<HTMLButtonElement>('.add-staff').click();
      await settle();
      expect(q('label[for=st-role]').textContent).toBe('Profession');
      expect(q('label[for=st-access]').textContent).toBe('Access');
      const access = q<HTMLSelectElement>('#st-access');
      expect(access.required).toBeTrue();
      expect(Array.from(access.options).map(o => o.textContent!.trim())).toEqual(['Admin', 'Physician', 'Nurse', 'Reception']);
      expect(access.value).toBe('NURSE'); // default for new members
      expect(q('#st-access-h').textContent).toBe('Admin: settings, staff and audit, plus everything else. Physician/Nurse: full patient file. Reception: demographics, contacts and appointments only.');
      expect(access.getAttribute('aria-describedby')).toBe('st-access-h');
    });

    it('creates with accessRole in the body', async () => {
      await init();
      q<HTMLButtonElement>('.add-staff').click();
      await settle();
      const name = q<HTMLInputElement>('#st-name');
      name.value = 'Isabelle Morin';
      name.dispatchEvent(new Event('input'));
      await choose('#st-access', 'RECEPTION');
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      const r = http.expectOne(`${api}/staff`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ displayName: 'Isabelle Morin', email: null, role: 'NURSE', accessRole: 'RECEPTION', auth0Subject: null });
      r.flush(staffMember({ id: 9, displayName: 'Isabelle Morin', accessRole: 'RECEPTION' }), { status: 201, statusText: 'Created' });
      await settle();
      expect(el.querySelector('.drawer')).toBeNull();
      expect(rowOf('Isabelle Morin').querySelector('app-role-badge')!.textContent).toContain('Reception');
    });

    it('Edit pre-fills the current access role', async () => {
      await init();
      await openMenu('Sam Doc', 'edit');
      expect(q<HTMLSelectElement>('#st-access').value).toBe('PHYSICIAN');
      expect(q<HTMLSelectElement>('#st-role').value).toBe('PHYSICIAN');
    });

    describe('saving your own record', () => {
      async function saveSelf(becomes: 'ADMIN' | 'NURSE') {
        await init();
        const perms = TestBed.inject(Permissions);
        perms.seed(me('ADMIN', { staffId: 6 }));
        const load = spyOn(perms, 'load').and.callFake(() => {
          perms.seed(me(becomes, { staffId: 6 }));
          return of(me(becomes, { staffId: 6 }));
        });
        const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
        await openMenu('Dev Admin', 'edit');
        await choose('#st-access', becomes);
        q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
        http.expectOne(`${api}/staff/6`).flush({ ...staff[0], accessRole: becomes });
        await settle();
        return { load, navigate };
      }

      it('reloads the permissions and stays when Settings is still allowed', async () => {
        const { load, navigate } = await saveSelf('ADMIN');
        expect(load).toHaveBeenCalledWith(true);
        expect(navigate).not.toHaveBeenCalled();
      });

      it('goes to the dashboard when SETTINGS_MANAGE was lost', async () => {
        const { load, navigate } = await saveSelf('NURSE');
        expect(load).toHaveBeenCalledWith(true);
        expect(navigate).toHaveBeenCalledWith(['/dashboard']);
      });

      it('does not reload the permissions after saving someone else', async () => {
        await init();
        TestBed.inject(Permissions).seed(me('ADMIN', { staffId: 6 }));
        const load = spyOn(TestBed.inject(Permissions), 'load');
        await openMenu('Sam Doc', 'edit');
        q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
        http.expectOne(`${api}/staff/2`).flush(staff[2]);
        await settle();
        expect(load).not.toHaveBeenCalled();
      });
    });

    it('LAST_ADMIN on save shows the banner and keeps the drawer open', async () => {
      await init();
      await openMenu('Dev Admin', 'edit');
      await choose('#st-access', 'NURSE');
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      http.expectOne(`${api}/staff/6`).flush({ status: 409, error: 'LAST_ADMIN', message: 'At least one active administrator is required', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(q('.drawer .banner--error').textContent).toContain('At least one active administrator is required. Make someone else an admin first.');
      expect(q('.drawer')).not.toBeNull();
    });

    it('maps an accessRole field error under the select', async () => {
      await init();
      await openMenu('Sam Doc', 'edit');
      q<HTMLFormElement>('.drawer form').dispatchEvent(new Event('submit'));
      http.expectOne(`${api}/staff/2`).flush({ status: 400, error: 'VALIDATION_FAILED', message: 'x', fieldErrors: { accessRole: 'must not be null' } }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(q('#st-access-h + .field-error').textContent).toBe('This field is required.');
    });
  });

  describe('deactivating', () => {
    it('LAST_ADMIN on deactivate shows the banner', async () => {
      await init();
      await openMenu('Marie Nurse', 'deactivate'); // someone else: no self confirmation
      http.expectOne(`${api}/staff/1/deactivate`).flush({ status: 409, error: 'LAST_ADMIN', message: 'x', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(q('.banner--error').textContent).toContain('At least one active administrator is required. Make someone else an admin first.');
    });

    it('deactivating someone else needs no extra confirmation', async () => {
      await init();
      await openMenu('Sam Doc', 'deactivate');
      expect(q('.confirm-inline')).toBeNull();
      http.expectOne(`${api}/staff/2/deactivate`).flush({ ...staff[2], active: false });
    });

    it('deactivating yourself asks first: "You will lose access immediately."', async () => {
      await init();
      TestBed.inject(Permissions).seed(me('ADMIN', { staffId: 6 }));
      await openMenu('Dev Admin', 'deactivate');
      http.expectNone(`${api}/staff/6/deactivate`);
      expect(q('.confirm-inline__q').textContent).toBe('You will lose access immediately.');
      q<HTMLButtonElement>('.confirm-inline__cancel').click();
      await settle();
      expect(q('.confirm-inline')).toBeNull();
      http.expectNone(`${api}/staff/6/deactivate`);
    });

    it('confirming deactivates and then reloads /api/me (the 403 would go to /not-staff)', async () => {
      await init();
      const load = spyOn(TestBed.inject(Permissions), 'load').and.returnValue(throwError(() => ({ status: 403, error: { status: 403, error: 'NOT_STAFF', message: 'x', fieldErrors: {} } })));
      await openMenu('Dev Admin', 'deactivate');
      q<HTMLButtonElement>('.confirm-inline__ok').click();
      expect(load).not.toHaveBeenCalled(); // only after the server accepted it
      http.expectOne(`${api}/staff/6/deactivate`).flush({ ...staff[0], active: false });
      expect(load).toHaveBeenCalledWith(true);
      await settle();
      expect(fixture.componentInstance.all.find(x => x.id === 6)!.active).toBeFalse();
    });

    it('a failed self-deactivation (last admin) does not reload /api/me', async () => {
      await init();
      const load = spyOn(TestBed.inject(Permissions), 'load');
      await openMenu('Dev Admin', 'deactivate');
      q<HTMLButtonElement>('.confirm-inline__ok').click();
      http.expectOne(`${api}/staff/6/deactivate`).flush({ status: 409, error: 'LAST_ADMIN', message: 'x', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(load).not.toHaveBeenCalled();
      expect(q('.banner--error').textContent).toContain('Make someone else an admin first.');
    });
  });
});
