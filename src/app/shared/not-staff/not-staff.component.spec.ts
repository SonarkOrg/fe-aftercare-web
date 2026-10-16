import { Title } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DEV_IDENTITY_UI } from '../../auth/dev-identity';
import { Permissions } from '../../auth/permissions.service';
import { StaffAuth } from '../../auth/staff-auth';
import { me } from '../../testing/fixtures';
import { NotStaffComponent } from './not-staff.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

@Component({ selector: 'app-fake-dev-ui', standalone: true, template: '<select id="dev-role"></select>' })
class FakeDevUi {}

describe('NotStaffComponent', () => {
  let fixture: ComponentFixture<NotStaffComponent>;
  let http: HttpTestingController;
  let router: Router;
  let auth: { subject$: BehaviorSubject<string | null>; logout: jasmine.Spy; getAccessToken: jasmine.Spy };
  let el: HTMLElement;

  function setup(extra: object[] = []) {
    auth = { subject$: new BehaviorSubject<string | null>('dev|unlinked'), logout: jasmine.createSpy('logout'), getAccessToken: jasmine.createSpy('getAccessToken').and.returnValue(of('t')) };
    TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), NotStaffComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: StaffAuth, useValue: auth }, ...extra]
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(NotStaffComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  it('sets the page title', () => {
    setup();
    expect(TestBed.inject(Title).getTitle()).toBe('Not linked · Aftercare');
  });

  it('explains the situation and shows the login id in a mono box', () => {
    setup();
    expect(el.querySelector('h1')!.textContent).toBe("Your login isn't linked to a staff account");
    expect(el.textContent).toContain('Ask a clinic administrator to add you in Settings → Staff and link this login:');
    const code = el.querySelector('.not-staff__code')!;
    expect(code.textContent).toBe('dev|unlinked');
    expect(code.classList).toContain('mono');
  });

  it('copies the login id to the clipboard and says so', async () => {
    setup();
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    (el.querySelector('.copy-sub') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(write).toHaveBeenCalledWith('dev|unlinked');
    expect(el.querySelector('[role=status]')!.textContent).toContain('Copied.');
  });

  it('falls back to a hint when copying is refused', async () => {
    setup();
    spyOn(navigator.clipboard, 'writeText').and.rejectWith(new Error('denied'));
    (el.querySelector('.copy-sub') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role=status]')!.textContent).toContain('Ctrl+C');
  });

  it('shows a placeholder while the login id is not known yet', () => {
    setup();
    auth.subject$.next(null);
    fixture.detectChanges();
    expect(el.querySelector('.not-staff__code')).toBeNull();
    expect(el.textContent).toContain("login identifier isn't available yet");
  });

  it('Try again reloads /api/me and goes to the dashboard once the login is linked', () => {
    setup();
    (el.querySelector('.try-again') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiUrl}/me`).flush(me('NURSE'));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(TestBed.inject(Permissions).role).toBe('NURSE');
  });

  it('Try again stays here and says so while the login is still unlinked', () => {
    setup();
    (el.querySelector('.try-again') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiUrl}/me`).flush({ status: 403, error: 'NOT_STAFF', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/dashboard');
    expect(el.textContent).toContain('Still not linked');
    expect((el.querySelector('.try-again') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('Try again reports other failures differently', () => {
    setup();
    (el.querySelector('.try-again') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiUrl}/me`).flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Could not check your account');
  });

  it('Log out forgets the member and logs out', () => {
    setup();
    const reset = spyOn(TestBed.inject(Permissions), 'reset');
    (el.querySelector('.logout') as HTMLButtonElement).click();
    expect(reset).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
  });

  it('shows no dev identity switcher without the dev provider', () => {
    setup();
    expect(el.querySelector('#dev-role')).toBeNull();
  });

  it('shows the dev switcher when the development build provides it (and devAuth is on)', () => {
    setup([{ provide: DEV_IDENTITY_UI, useValue: FakeDevUi }]);
    expect(el.querySelector('#dev-role')).toBeNull(); // environment.devAuth is false in the test build
    fixture.componentInstance.devAuth = true;
    fixture.detectChanges();
    expect(el.querySelector('#dev-role')).not.toBeNull();
  });
});
