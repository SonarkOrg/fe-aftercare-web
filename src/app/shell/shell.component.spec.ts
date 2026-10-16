import { Component } from '@angular/core';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AlertCountService } from '../Services/AlertCount.service';
import { MessageCountService } from '../Services/MessageCount.service';
import { DEV_IDENTITY_UI } from '../auth/dev-identity';
import { DevIdentitySelectComponent } from '../auth/dev-identity-select.component';
import { DevStaffAuth } from '../auth/dev-staff-auth';
import { Permissions } from '../auth/permissions.service';
import { StaffAuth } from '../auth/staff-auth';
import { AccessRole } from '../models/me.model';
import { providePermissions } from '../testing/fixtures';
import { RoleBadgeComponent } from '../shared/role-badge/role-badge.component';
import { IconComponent } from '../shared/icon/icon.component';
import { LanguageSwitchComponent } from '../i18n/language-switch/language-switch.component';
import { PageTitleService } from './page-title.service';
import { ShellComponent } from './shell.component';
import { I18nTestingModule } from '../testing/i18n-testing.module';

@Component({ template: '<p>page</p>' })
class DummyComponent {}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let el: HTMLElement;
  let count$: BehaviorSubject<number>;
  let refresh: jasmine.Spy;
  let unread$: BehaviorSubject<number>;
  let msgRefresh: jasmine.Spy;
  let msgStart: jasmine.Spy;
  let msgStop: jasmine.Spy;
  let auth: { userName$: any; logout: jasmine.Spy };

  beforeEach(async () => {
    count$ = new BehaviorSubject(0);
    refresh = jasmine.createSpy('refresh');
    unread$ = new BehaviorSubject(0);
    msgRefresh = jasmine.createSpy('msgRefresh');
    msgStart = jasmine.createSpy('start');
    msgStop = jasmine.createSpy('stop');
    auth = { userName$: of('Dev Nurse'), logout: jasmine.createSpy('logout') };
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, RouterTestingModule.withRoutes([
        { path: 'a', component: DummyComponent, data: { title: 'page.alerts' } },
        { path: 'b', component: DummyComponent, data: { title: 'page.reports' } },
        { path: 'settings', component: DummyComponent, data: { title: 'page.settings' } }
      ]), FormsModule],
      declarations: [ShellComponent, IconComponent, RoleBadgeComponent, LanguageSwitchComponent, DummyComponent],
      providers: [
        providePermissions('ADMIN'),
        { provide: StaffAuth, useValue: auth },
        { provide: AlertCountService, useValue: { openCount$: count$, refresh } },
        { provide: MessageCountService, useValue: { unread$, refresh: msgRefresh, start: msgStart, stop: msgStop } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ShellComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const links = () => Array.from(el.querySelectorAll<HTMLAnchorElement>('.top-nav .top-nav__item'));
  const openMenu = () => {
    (el.querySelector('.menu-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('links to the seven staff sections in the top bar, Messages and Reports included', () => {
    expect(links().map(a => a.getAttribute('href'))).toEqual(['/dashboard', '/patients', '/appointments', '/alerts', '/messages', '/reports', '/questionnaires']);
    expect(links().map(a => a.textContent!.trim())).toEqual(['Dashboard', 'Patients', 'Appointments', 'Alerts', 'Messages', 'Reports', 'Forms']);
    expect(el.querySelector('nav.top-nav')!.getAttribute('aria-label')).toBe('Main');
  });

  it('has a skip link and a focusable main landmark', () => {
    expect(el.querySelector('.skip-link')!.getAttribute('href')).toBe('#main');
    expect(el.querySelector('main#main')!.getAttribute('tabindex')).toBe('-1');
  });

  it('hides the alert count and bell dot at 0; at 3 shows both with an accessible name', () => {
    expect(el.querySelector('.top-nav__count')).toBeNull();
    expect(el.querySelector('.icon-btn__dot')).toBeNull();
    expect(links()[3].getAttribute('aria-label')).toBeNull();
    expect(el.querySelector('.alerts-btn')!.getAttribute('aria-label')).toBe('Alerts');
    count$.next(3);
    fixture.detectChanges();
    expect(el.querySelector('.top-nav__count')!.textContent!.trim()).toBe('3');
    expect(el.querySelector('.icon-btn__dot')).not.toBeNull();
    expect(links()[3].getAttribute('aria-label')).toBe('Alerts, 3 open');
    expect(el.querySelector('.alerts-btn')!.getAttribute('aria-label')).toBe('Alerts, 3 open');
  });

  it('shows the unread message count on Messages with an accessible name', () => {
    const messages = () => links()[4];
    expect(messages().querySelector('.top-nav__count')).toBeNull();
    expect(messages().getAttribute('aria-label')).toBeNull();
    unread$.next(1);
    fixture.detectChanges();
    expect(messages().querySelector('.top-nav__count')!.textContent!.trim()).toBe('1');
    expect(messages().getAttribute('aria-label')).toBe('Messages, 1 unread');
    expect(links()[3].querySelector('.top-nav__count')).toBeNull(); // the alert badge is independent
  });

  it('has a Settings icon button that links to /settings, before the bell', () => {
    const btn = el.querySelector('.app-top__right .settings-btn') as HTMLAnchorElement;
    expect(btn.getAttribute('aria-label')).toBe('Settings');
    expect(btn.getAttribute('href')).toBe('/settings');
    expect(btn.nextElementSibling!.classList).toContain('alerts-btn');
  });

  it('the Settings icon button is marked current (aria-current + active style) only on /settings', async () => {
    const btn = el.querySelector('.settings-btn') as HTMLAnchorElement;
    expect(btn.hasAttribute('aria-current')).toBeFalse();
    await TestBed.inject(Router).navigateByUrl('/settings');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-current')).toBe('page');
    expect(btn.classList).toContain('is-active');
    await TestBed.inject(Router).navigateByUrl('/a');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(btn.hasAttribute('aria-current')).toBeFalse();
  });

  it('starts the message count polling on init and stops it on destroy', () => {
    expect(msgStart).toHaveBeenCalledTimes(1);
    expect(msgRefresh).toHaveBeenCalled();
    fixture.destroy();
    expect(msgStop).toHaveBeenCalledTimes(1);
  });

  it('shows the dev badge only with devAuth (in the user pill and in the menu)', () => {
    expect(el.querySelector('.user-pill .chip--warning')).toBeNull();
    fixture.componentInstance.devAuth = true;
    fixture.detectChanges();
    expect(el.querySelector('.user-pill .chip--warning')!.textContent).toContain('DEV AUTH: Admin');
    openMenu();
    expect(el.querySelector('#top-menu .chip--warning')!.textContent).toContain('Dev auth');
  });

  it('the menu holds the seven links plus Settings last, search and log out; logout calls StaffAuth.logout', () => {
    openMenu();
    const items = Array.from(el.querySelectorAll<HTMLAnchorElement>('#top-menu .menu-nav__item'));
    expect(items.length).toBe(8);
    expect(items[7].getAttribute('href')).toBe('/settings');
    (el.querySelector('#top-menu .logout') as HTMLButtonElement).click();
    expect(auth.logout).toHaveBeenCalled();
  });

  it('search Enter navigates to /patients?q= and closes the menu', () => {
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    openMenu();
    const input = el.querySelector('#top-menu input[type=search]') as HTMLInputElement;
    input.value = 'roy';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(nav).toHaveBeenCalledWith(['/patients'], { queryParams: { q: 'roy' } });
    expect(el.querySelector('#top-menu')).toBeNull();
  });

  it('the menu button toggles aria-expanded and the popover; Esc closes it and returns focus', () => {
    document.body.appendChild(el);
    const btn = el.querySelector('.menu-btn') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe('top-menu');
    openMenu();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#top-menu')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#top-menu')).toBeNull();
    expect(document.activeElement).toBe(btn);
    el.remove();
  });

  describe('navigation side effects', () => {
    it('moves focus to <main> and refreshes the alert count on a path change, but NOT on a query-param-only change', async () => {
      const router = TestBed.inject(Router);
      const main = fixture.componentInstance.main.nativeElement;
      const focus = spyOn(main, 'focus');
      const titles = TestBed.inject(PageTitleService);
      const setTitle = spyOn(titles, 'set').and.callThrough();
      await router.navigateByUrl('/a'); // first navigation: no focus steal
      fixture.detectChanges();
      expect(focus).not.toHaveBeenCalled();
      refresh.calls.reset();
      msgRefresh.calls.reset();
      setTitle.calls.reset();

      await router.navigateByUrl('/b');
      fixture.detectChanges();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(msgRefresh).toHaveBeenCalledTimes(1);
      expect(setTitle).toHaveBeenCalledWith('page.reports');

      // typing in the patients search and switching tabs both use replaceUrl query-param navigations
      focus.calls.reset();
      refresh.calls.reset();
      msgRefresh.calls.reset();
      setTitle.calls.reset();
      titles.setText('Custom page title'); // e.g. the patient name set by a page
      setTitle.calls.reset();
      for (const q of ['r', 'ro', 'roy']) {
        await router.navigate([], { queryParams: { q }, replaceUrl: true });
        fixture.detectChanges();
      }
      await router.navigate([], { queryParams: { tab: 'alerts' }, queryParamsHandling: 'merge', replaceUrl: true });
      expect(router.url).toBe('/b?q=roy&tab=alerts');
      expect(focus).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(msgRefresh).not.toHaveBeenCalled();
      expect(setTitle).not.toHaveBeenCalled();
      expect(titles.title$.value).toBe('Custom page title');
    });

    it('a shell created after the first navigation ended keeps a page-set title on a tab (query-only) change', async () => {
      const router = TestBed.inject(Router);
      const titles = TestBed.inject(PageTitleService);
      await router.navigateByUrl('/a');
      TestBed.createComponent(ShellComponent).detectChanges();
      titles.setText('Jane Doe');
      await router.navigate([], { queryParams: { tab: 'medical' }, replaceUrl: true });
      expect(titles.title$.value).toBe('Jane Doe');
    });
  });
});

describe('ShellComponent by access role', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let fixture: ComponentFixture<ShellComponent>;
  let el: HTMLElement;

  /** What each role must see in the top bar: exactly this, in this order. */
  const NAV: Record<AccessRole, string[]> = {
    ADMIN: ['Dashboard', 'Patients', 'Appointments', 'Alerts', 'Messages', 'Reports', 'Forms'],
    PHYSICIAN: ['Dashboard', 'Patients', 'Appointments', 'Alerts', 'Messages', 'Reports', 'Forms'],
    NURSE: ['Dashboard', 'Patients', 'Appointments', 'Alerts', 'Messages', 'Reports', 'Forms'],
    RECEPTION: ['Dashboard', 'Patients', 'Appointments', 'Forms']
  };
  const SETTINGS: Record<AccessRole, boolean> = { ADMIN: true, PHYSICIAN: false, NURSE: false, RECEPTION: false };
  const BELL: Record<AccessRole, boolean> = { ADMIN: true, PHYSICIAN: true, NURSE: true, RECEPTION: false };
  const BADGE: Record<AccessRole, string> = { ADMIN: 'Admin', PHYSICIAN: 'Physician', NURSE: 'Nurse', RECEPTION: 'Reception' };

  function setup(role: AccessRole, extra: object[] = []) {
    TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [ShellComponent, IconComponent, RoleBadgeComponent, LanguageSwitchComponent],
      providers: [providePermissions(role), { provide: StaffAuth, useValue: { userName$: of(null), logout: jasmine.createSpy('logout') } }, ...extra]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ShellComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  /** Answers whatever the count services asked for (the alert request follows the settings request). */
  function drain(): void {
    for (let i = 0; i < 3; i++) {
      http.match(r => r.url.startsWith(api)).forEach(r => r.flush(r.request.url.includes('unread') ? { unreadMessages: 0 } : r.request.url.includes('settings') ? { notifySeverities: ['HIGH'] } : []));
    }
  }

  const nav = () => Array.from(el.querySelectorAll('.top-nav .top-nav__item')).map(a => a.textContent!.trim().replace(/\d+$/, '').trim());

  for (const role of ['ADMIN', 'PHYSICIAN', 'NURSE', 'RECEPTION'] as AccessRole[]) {
    it(`${role} sees exactly its sections, its settings icon and bell, and its badge`, () => {
      setup(role);
      drain();
      fixture.detectChanges();
      expect(nav()).withContext('nav').toEqual(NAV[role]);
      expect(!!el.querySelector('.settings-btn')).withContext('settings icon').toBe(SETTINGS[role]);
      expect(!!el.querySelector('.alerts-btn')).withContext('bell').toBe(BELL[role]);
      const badge = el.querySelector('.user-pill app-role-badge .chip')!;
      expect(badge.textContent).toContain(BADGE[role]);
      expect(badge.getAttribute('aria-label')).toBe('Access role: ' + BADGE[role]);
      (el.querySelector('.menu-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      const menu = Array.from(el.querySelectorAll('#top-menu .menu-nav__item')).map(a => a.textContent!.trim());
      expect(menu).withContext('menu').toEqual(SETTINGS[role] ? [...NAV[role], 'Settings'] : NAV[role]);
      expect(el.querySelector('#top-menu app-role-badge')).not.toBeNull();
    });
  }

  it('RECEPTION makes no alert or unread-count request', () => {
    setup('RECEPTION');
    expect(http.match(r => r.url.startsWith(`${api}/alerts`)).length).toBe(0);
    expect(http.match(`${api}/messages/unread-count`).length).toBe(0);
    expect(http.match(`${api}/settings/clinic`).length).toBe(0);
  });

  it('NURSE does ask for the alert and unread counts', () => {
    setup('NURSE');
    const unread = http.expectOne(`${api}/messages/unread-count`);
    expect(unread.request.method).toBe('GET');
    unread.flush({ unreadMessages: 2 });
    const clinic = http.expectOne(`${api}/settings/clinic`);
    expect(clinic.request.method).toBe('GET');
    clinic.flush({ notifySeverities: ['HIGH', 'MEDIUM'] });
    const alerts = http.expectOne(r => r.url === `${api}/alerts`);
    expect(alerts.request.method).toBe('GET');
    alerts.flush([]);
  });

  it('shows the directory name from /api/me, not the login name', () => {
    setup('RECEPTION');
    expect(el.querySelector('.user-pill__name')!.textContent!.trim()).toBe('Dev Reception');
    expect(el.querySelector('.user-pill__initials')!.textContent!.trim()).toBe('DR');
  });

  it('has no dev identity select without the dev provider, even with devAuth', () => {
    setup('ADMIN');
    drain();
    fixture.componentInstance.devAuth = true;
    fixture.detectChanges();
    (el.querySelector('.menu-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('#dev-role')).toBeNull();
  });

  describe('dev identity select', () => {
    let switchIdentity: jasmine.Spy;
    const dev = () => {
      switchIdentity = jasmine.createSpy('switchIdentity');
      setup('NURSE', [{ provide: DEV_IDENTITY_UI, useValue: DevIdentitySelectComponent }, { provide: DevStaffAuth, useValue: { identity: { role: 'NURSE' }, switchIdentity } }]);
      drain();
    };
    const open = () => {
      (el.querySelector('.menu-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    it('is visible only with devAuth and lists the five identities', () => {
      dev();
      open();
      expect(el.querySelector('#dev-role')).toBeNull(); // devAuth is false in the test environment
      fixture.componentInstance.devAuth = true;
      fixture.detectChanges();
      const select = el.querySelector<HTMLSelectElement>('#top-menu select#dev-role')!;
      expect(select.getAttribute('aria-label')).toBe('Dev identity');
      expect(Array.from(select.options).map(o => o.textContent!.trim())).toEqual([
        'Admin (dev|admin-1)', 'Physician (auth0|seed-surgeon)', 'Nurse (dev|nurse-1)', 'Reception (dev|reception-1)', 'Unlinked login (dev|unlinked)']);
      expect(select.value).toBe('NURSE');
    });

    it('changing it calls switchIdentity with a role, or with the unlinked sub', () => {
      dev();
      fixture.componentInstance.devAuth = true;
      open();
      const select = el.querySelector<HTMLSelectElement>('#dev-role')!;
      select.value = 'RECEPTION';
      select.dispatchEvent(new Event('change'));
      expect(switchIdentity).toHaveBeenCalledWith({ role: 'RECEPTION' });
      select.value = 'UNLINKED';
      select.dispatchEvent(new Event('change'));
      expect(switchIdentity).toHaveBeenCalledWith({ sub: 'dev|unlinked' });
    });
  });
});

describe('ShellComponent logout', () => {
  it('forgets the member before logging out', () => {
    const logout = jasmine.createSpy('logout');
    TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [ShellComponent, IconComponent, RoleBadgeComponent, LanguageSwitchComponent],
      providers: [providePermissions('ADMIN'), { provide: StaffAuth, useValue: { userName$: of(null), logout } }]
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    http.match(() => true);
    const reset = spyOn(TestBed.inject(Permissions), 'reset').and.callThrough();
    fixture.componentInstance.logout();
    expect(reset).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });
});
