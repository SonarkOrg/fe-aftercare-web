import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Me } from '../models/me.model';
import { me } from '../testing/fixtures';
import { Permissions } from './permissions.service';

describe('Permissions', () => {
  const url = `${environment.apiUrl}/me`;
  let http: HttpTestingController;
  let permissions: Permissions;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpTestingController);
    permissions = TestBed.inject(Permissions);
  });
  afterEach(() => http.verify());

  it('knows nobody before the first load: nothing is allowed, no role', async () => {
    expect(permissions.me).toBeNull();
    expect(permissions.role).toBeNull();
    expect(permissions.can('PATIENT_READ')).toBeFalse();
    expect(permissions.canAny('PATIENT_READ', 'CLINICAL_READ')).toBeFalse();
    expect(await firstValueFrom(permissions.me$)).toBeNull();
  });

  it('load GETs /api/me once and caches it', async () => {
    const first = firstValueFrom(permissions.load());
    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(me('NURSE'));
    expect((await first).accessRole).toBe('NURSE');
    expect(permissions.role).toBe('NURSE');
    expect((await firstValueFrom(permissions.load())).displayName).toBe('Dev Nurse');
    http.expectNone(url);
  });

  it('shares an in-flight request between concurrent callers', async () => {
    const a = firstValueFrom(permissions.load());
    const b = firstValueFrom(permissions.load());
    const c = firstValueFrom(permissions.load());
    http.expectOne(url).flush(me('ADMIN'));
    expect((await Promise.all([a, b, c])).map(m => m.accessRole)).toEqual(['ADMIN', 'ADMIN', 'ADMIN']);
  });

  it('can, canAny and can$ follow the permission list', async () => {
    const p = firstValueFrom(permissions.load());
    http.expectOne(url).flush(me('RECEPTION'));
    await p;
    expect(permissions.can('PATIENT_READ')).toBeTrue();
    expect(permissions.can('CLINICAL_READ')).toBeFalse();
    expect(permissions.canAny('CLINICAL_READ', 'APPOINTMENT_WRITE')).toBeTrue();
    expect(permissions.canAny('CLINICAL_READ', 'AUDIT_READ')).toBeFalse();
    expect(permissions.canAny()).toBeFalse();
    expect(await firstValueFrom(permissions.can$('APPOINTMENT_READ'))).toBeTrue();
    expect(await firstValueFrom(permissions.can$('SETTINGS_MANAGE'))).toBeFalse();
  });

  it('can$ only emits when the answer changes', () => {
    const seen: boolean[] = [];
    const sub = permissions.can$('CLINICAL_READ').subscribe(v => seen.push(v));
    permissions.seed(me('RECEPTION'));
    permissions.seed(me('RECEPTION', { displayName: 'Other' }));
    permissions.seed(me('NURSE'));
    permissions.reset();
    sub.unsubscribe();
    expect(seen).toEqual([false, true, false]);
  });

  it('reset forgets the member and the next load asks again', async () => {
    const first = firstValueFrom(permissions.load());
    http.expectOne(url).flush(me('NURSE'));
    await first;
    permissions.reset();
    expect(permissions.me).toBeNull();
    expect(permissions.can('PATIENT_READ')).toBeFalse();
    const again = firstValueFrom(permissions.load());
    http.expectOne(url).flush(me('ADMIN'));
    expect((await again).accessRole).toBe('ADMIN');
  });

  it('load(true) refetches even when cached, and publishes the new member', async () => {
    const first = firstValueFrom(permissions.load());
    http.expectOne(url).flush(me('NURSE'));
    await first;
    const seen: (Me | null)[] = [];
    permissions.me$.subscribe(m => seen.push(m));
    const forced = firstValueFrom(permissions.load(true));
    http.expectOne(url).flush(me('PHYSICIAN'));
    expect((await forced).accessRole).toBe('PHYSICIAN');
    expect(seen.map(m => m?.accessRole)).toEqual(['NURSE', 'PHYSICIAN']);
  });

  it('propagates errors, keeps nothing, and the next load tries again', async () => {
    const failed = firstValueFrom(permissions.load());
    http.expectOne(url).flush({ status: 403, error: 'NOT_STAFF', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    await expectAsync(failed).toBeRejected();
    expect(permissions.me).toBeNull();
    const retry = firstValueFrom(permissions.load());
    http.expectOne(url).flush(me('NURSE'));
    expect((await retry).accessRole).toBe('NURSE');
  });
});
