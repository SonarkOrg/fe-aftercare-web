import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AlertCountService } from '../Services/AlertCount.service';
import { StaffAuth } from '../auth/staff-auth';
import { IconComponent } from '../shared/icon/icon.component';
import { PageTitleService } from './page-title.service';
import { ShellComponent } from './shell.component';

@Component({ template: '<p>page</p>' })
class DummyComponent {}

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let el: HTMLElement;
  let count$: BehaviorSubject<number>;
  let refresh: jasmine.Spy;
  let auth: { userName$: any; logout: jasmine.Spy };

  beforeEach(async () => {
    count$ = new BehaviorSubject(0);
    refresh = jasmine.createSpy('refresh');
    auth = { userName$: of('Dev Nurse'), logout: jasmine.createSpy('logout') };
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([
        { path: 'a', component: DummyComponent, data: { title: 'A' } },
        { path: 'b', component: DummyComponent, data: { title: 'B' } }
      ]), FormsModule],
      declarations: [ShellComponent, IconComponent, DummyComponent],
      providers: [
        { provide: StaffAuth, useValue: auth },
        { provide: AlertCountService, useValue: { openCount$: count$, refresh } }
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

  it('links to the five staff sections in the top bar', () => {
    expect(links().map(a => a.getAttribute('href'))).toEqual(['/dashboard', '/patients', '/appointments', '/alerts', '/questionnaires']);
    expect(links().map(a => a.textContent!.trim())).toEqual(['Dashboard', 'Patients', 'Appointments', 'Alerts', 'Forms']);
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

  it('shows the dev badge only with devAuth (in the user pill and in the menu)', () => {
    expect(el.querySelector('.user-pill .chip--warning')).toBeNull();
    fixture.componentInstance.devAuth = true;
    fixture.detectChanges();
    expect(el.querySelector('.user-pill .chip--warning')!.textContent).toContain('DEV AUTH — local only');
    openMenu();
    expect(el.querySelector('#top-menu .chip--warning')!.textContent).toContain('Dev auth');
  });

  it('the menu holds the five links, search and log out; logout calls StaffAuth.logout', () => {
    openMenu();
    expect(el.querySelectorAll('#top-menu .menu-nav__item').length).toBe(5);
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
      setTitle.calls.reset();

      await router.navigateByUrl('/b');
      fixture.detectChanges();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(setTitle).toHaveBeenCalledWith('B');

      // typing in the patients search and switching tabs both use replaceUrl query-param navigations
      focus.calls.reset();
      refresh.calls.reset();
      setTitle.calls.reset();
      titles.set('Custom page title'); // e.g. the patient name set by a page
      setTitle.calls.reset();
      for (const q of ['r', 'ro', 'roy']) {
        await router.navigate([], { queryParams: { q }, replaceUrl: true });
        fixture.detectChanges();
      }
      await router.navigate([], { queryParams: { tab: 'alerts' }, queryParamsHandling: 'merge', replaceUrl: true });
      expect(router.url).toBe('/b?q=roy&tab=alerts');
      expect(focus).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(setTitle).not.toHaveBeenCalled();
      expect(titles.title$.value).toBe('Custom page title');
    });
  });
});
