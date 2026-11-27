import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { PAGE_ROUTES } from '../components/pages.module';
import { AccessRole, Permission } from '../models/me.model';
import { me, providePermissions, ROLE_PERMISSIONS } from '../testing/fixtures';
import { Permissions } from './permissions.service';
import { permissionGuard } from './permission.guard';

/** PRIV-A-23: the privacy-officer grant is additive (AUDIT_READ only), so /privacy opens and /settings stays closed. */
describe('privacy officer grant (additive AUDIT_READ)', () => {
  const ROLES: AccessRole[] = ['ADMIN', 'PHYSICIAN', 'NURSE', 'RECEPTION'];
  const withGrant = (role: AccessRole): Permission[] => {
    const own = me(role).permissions;
    return own.includes('AUDIT_READ') ? [...own] : [...own, 'AUDIT_READ'];
  };

  const open = (role: AccessRole, path: string): Promise<boolean | UrlTree> => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [providePermissions(role, { permissions: withGrant(role) })]
    });
    const route = PAGE_ROUTES.find(r => r.path === path)!;
    return firstValueFrom(TestBed.runInInjectionContext(() => permissionGuard({ data: route.data } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
  };

  for (const role of ROLES) {
    it(`${role} with the grant can use AUDIT_READ and nothing else is added`, () => {
      TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [providePermissions(role, { permissions: withGrant(role) })] });
      const perms = TestBed.inject(Permissions);
      expect(perms.can('AUDIT_READ')).toBeTrue();
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(perms.can(p)).withContext(p).toBeTrue();
      }
      const extra = withGrant(role).filter(p => !ROLE_PERMISSIONS[role].includes(p));
      expect(extra).toEqual(role === 'ADMIN' ? [] : ['AUDIT_READ']);
      expect(perms.can('SETTINGS_MANAGE')).toBe(role === 'ADMIN');
      expect(perms.can('STAFF_MANAGE')).toBe(role === 'ADMIN');
      expect(perms.can('CLINICAL_READ')).toBe(role !== 'RECEPTION');
    });
  }

  it('a NURSE with the grant reaches /privacy but /settings goes to /forbidden', async () => {
    expect(await open('NURSE', 'privacy')).toBeTrue();
    TestBed.resetTestingModule();
    const settings = await open('NURSE', 'settings');
    expect(settings instanceof UrlTree ? TestBed.inject(Router).serializeUrl(settings) : settings).toBe('/forbidden');
  });

  it('without the grant a NURSE is sent away from /privacy', async () => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule, HttpClientTestingModule], providers: [providePermissions('NURSE')] });
    const route = PAGE_ROUTES.find(r => r.path === 'privacy')!;
    const r = await firstValueFrom(TestBed.runInInjectionContext(() => permissionGuard({ data: route.data } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
    expect(r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r).toBe('/forbidden');
  });
});
