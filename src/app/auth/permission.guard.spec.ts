import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, Subject, firstValueFrom, throwError } from 'rxjs';
import { Me, Permission } from '../models/me.model';
import { me } from '../testing/fixtures';
import { meGuard, permissionGuard } from './permission.guard';
import { Permissions } from './permissions.service';

describe('route guards', () => {
  let permissions: jasmine.SpyObj<Permissions> & { canAny: jasmine.Spy };
  let router: Router;
  let load$: Subject<Me>;

  beforeEach(() => {
    load$ = new Subject<Me>();
    permissions = jasmine.createSpyObj('Permissions', ['load', 'canAny']) as never;
    permissions.load.and.callFake(() => load$);
    TestBed.configureTestingModule({ imports: [RouterTestingModule], providers: [{ provide: Permissions, useValue: permissions }] });
    router = TestBed.inject(Router);
  });

  const state = {} as RouterStateSnapshot;
  const run = (guard: typeof meGuard, data: Record<string, unknown> = {}): Promise<boolean | UrlTree> =>
    firstValueFrom(TestBed.runInInjectionContext(() => guard({ data } as unknown as ActivatedRouteSnapshot, state)) as Observable<boolean | UrlTree>);
  const urlOf = (t: boolean | UrlTree) => (t instanceof UrlTree ? router.serializeUrl(t) : t);
  const forbid = (error: string) => ({ error: { status: 403, error, message: 'x', fieldErrors: {} } });

  describe('meGuard', () => {
    it('loads /api/me and lets the shell open', async () => {
      const result = run(meGuard);
      load$.next(me('NURSE'));
      expect(await result).toBeTrue();
    });

    it('sends an unlinked login (NOT_STAFF) to /not-staff', async () => {
      permissions.load.and.returnValue(throwError(() => forbid('NOT_STAFF')));
      expect(urlOf(await run(meGuard))).toBe('/not-staff');
    });

    it('lets the user in on any other failure: a backend hiccup must not lock anyone out', async () => {
      permissions.load.and.returnValue(throwError(() => ({ status: 500, error: null })));
      expect(await run(meGuard)).toBeTrue();
      permissions.load.and.returnValue(throwError(() => forbid('FORBIDDEN')));
      expect(await run(meGuard)).toBeTrue();
    });
  });

  describe('permissionGuard', () => {
    it('waits for the member to load before deciding', async () => {
      permissions.canAny.and.returnValue(true);
      let settled = false;
      const result = run(permissionGuard, { permission: 'CLINICAL_READ' }).then(r => ((settled = true), r));
      await Promise.resolve();
      expect(settled).toBeFalse();
      load$.next(me('NURSE'));
      expect(await result).toBeTrue();
    });

    it('allows a member who has the permission', async () => {
      permissions.canAny.and.returnValue(true);
      const result = run(permissionGuard, { permission: 'REPORTS_READ' });
      load$.next(me('NURSE'));
      expect(await result).toBeTrue();
      expect(permissions.canAny).toHaveBeenCalledWith('REPORTS_READ');
    });

    it('sends a member without it to /forbidden', async () => {
      permissions.canAny.and.returnValue(false);
      const result = run(permissionGuard, { permission: 'SETTINGS_MANAGE' });
      load$.next(me('RECEPTION'));
      expect(urlOf(await result)).toBe('/forbidden');
    });

    it('permissionAny needs only one of the permissions', async () => {
      const needed: Permission[] = ['CLINICAL_READ', 'APPOINTMENT_READ'];
      permissions.canAny.and.returnValue(true);
      const result = run(permissionGuard, { permissionAny: needed });
      load$.next(me('RECEPTION'));
      expect(await result).toBeTrue();
      expect(permissions.canAny).toHaveBeenCalledWith('CLINICAL_READ', 'APPOINTMENT_READ');
    });

    it('a route without a permission is open to every member', async () => {
      const result = run(permissionGuard, {});
      load$.next(me('RECEPTION'));
      expect(await result).toBeTrue();
    });

    it('NOT_STAFF while waiting goes to /not-staff; other errors do not block', async () => {
      permissions.load.and.returnValue(throwError(() => forbid('NOT_STAFF')));
      expect(urlOf(await run(permissionGuard, { permission: 'CLINICAL_READ' }))).toBe('/not-staff');
      permissions.load.and.returnValue(throwError(() => ({ status: 0, error: null })));
      expect(await run(permissionGuard, { permission: 'CLINICAL_READ' })).toBeTrue();
    });
  });
});
