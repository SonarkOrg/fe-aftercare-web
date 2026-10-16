import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subscription, combineLatest, filter, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertCountService } from '../Services/AlertCount.service';
import { MessageCountService } from '../Services/MessageCount.service';
import { DEV_IDENTITY_UI } from '../auth/dev-identity';
import { Permissions } from '../auth/permissions.service';
import { StaffAuth } from '../auth/staff-auth';
import { AccessRole, Me, Permission, ROLE_LABEL } from '../models/me.model';
import { I18nService } from '../i18n/i18n.service';
import { TKey } from '../i18n/i18n.types';
import { IconName } from '../shared/icon/icon.component';
import { PageTitleService } from './page-title.service';

interface NavItem { label: TKey; link: string; icon: IconName; badge?: 'alerts' | 'messages'; permission?: Permission }

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css'
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly items: NavItem[] = [
    { label: 'shell.nav.dashboard', link: '/dashboard', icon: 'dashboard' },
    { label: 'shell.nav.patients', link: '/patients', icon: 'users' },
    { label: 'shell.nav.appointments', link: '/appointments', icon: 'calendar', permission: 'APPOINTMENT_READ' },
    { label: 'shell.nav.alerts', link: '/alerts', icon: 'bell', badge: 'alerts', permission: 'CLINICAL_READ' },
    { label: 'shell.nav.messages', link: '/messages', icon: 'message', badge: 'messages', permission: 'CLINICAL_READ' },
    { label: 'shell.nav.reports', link: '/reports', icon: 'bar-chart', permission: 'REPORTS_READ' },
    { label: 'shell.nav.forms', link: '/questionnaires', icon: 'file', permission: 'FORMS_READ' }
  ];
  /** The items this member may open (hidden, not disabled). */
  navItems: NavItem[] = [];
  me: Me | null = null;
  alerts = 0;
  messages = 0;
  devAuth = environment.devAuth;
  menuOpen = false;
  searchTerm = '';
  userName$: Observable<string | null>;
  initials$: Observable<string>;
  canSettings = false;
  canClinical = false;

  @ViewChild('main', { static: true }) main!: ElementRef<HTMLElement>;
  @ViewChild('menuButton') menuButton?: ElementRef<HTMLButtonElement>;

  private sub = new Subscription();
  private lastPath: string | null = null;

  constructor(
    private router: Router,
    private auth: StaffAuth,
    public titles: PageTitleService,
    public alertCount: AlertCountService,
    public messageCount: MessageCountService,
    private host: ElementRef<HTMLElement>,
    public permissions: Permissions,
    public i18n: I18nService,
    @Optional() @Inject(DEV_IDENTITY_UI) public devUi: unknown
  ) {
    // The directory name (from /api/me) wins; the login's own name is the fallback.
    this.userName$ = combineLatest([permissions.me$, auth.userName$]).pipe(map(([me, n]) => me?.displayName ?? n));
    this.initials$ = this.userName$.pipe(map(n => (n ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')));
  }

  ngOnInit(): void {
    this.sub.add(this.permissions.me$.subscribe(me => {
      this.me = me;
      this.navItems = this.items.filter(i => !i.permission || this.permissions.can(i.permission));
      this.canSettings = this.permissions.can('SETTINGS_MANAGE');
      this.canClinical = this.permissions.can('CLINICAL_READ');
    }));
    this.alertCount.refresh();
    this.messageCount.refresh();
    this.messageCount.start();
    this.sub.add(this.alertCount.openCount$.subscribe(n => (this.alerts = n)));
    this.sub.add(this.messageCount.unread$.subscribe(n => (this.messages = n)));
    // The shell can be created after the first navigation has ended (it sits behind async guards): start from that path,
    // so a later query-only change (a tab click) is not mistaken for a new page and does not reset a page-set title.
    if (this.router.navigated) {
      this.lastPath = this.router.url.split(/[?#]/)[0];
    }
    this.sub.add(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(e => {
      // Query-param-only navigations (search typing, filters, tabs) keep the same path: they must not steal focus,
      // reset the title or refetch the alert count.
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      if (path === this.lastPath) {
        return;
      }
      const first = this.lastPath === null;
      this.lastPath = path;
      this.applyRouteData();
      this.alertCount.refresh();
      this.messageCount.refresh();
      this.closeMenu(false);
      if (!first) {
        this.main.nativeElement.focus({ preventScroll: true });
      }
    }));
    this.applyRouteData();
  }

  ngOnDestroy(): void {
    this.messageCount.stop();
    this.sub.unsubscribe();
  }

  private applyRouteData(): void {
    let snap = this.router.routerState.snapshot.root;
    while (snap.firstChild) {
      snap = snap.firstChild;
    }
    const data = snap.data as { title?: TKey; parent?: { label: TKey; link: string } };
    if (data.title) {
      this.titles.set(data.title);
    }
    this.titles.setParent(data.parent ?? null);
  }

  /** The count behind an item's badge (0 for items without one). */
  count(item: NavItem): number {
    return item.badge === 'alerts' ? this.alerts : item.badge === 'messages' ? this.messages : 0;
  }

  badgeLabel(item: NavItem): string | null {
    const n = this.count(item);
    return item.badge && n > 0 ? this.i18n.t(item.badge === 'alerts' ? 'shell.nav.badge.alerts' : 'shell.nav.badge.messages', { count: n }) : null;
  }

  search(): void {
    const q = this.searchTerm.trim();
    this.router.navigate(['/patients'], { queryParams: q ? { q } : {} });
    this.closeMenu(false);
  }

  get roleLabel(): string {
    return this.me ? this.i18n.t(ROLE_LABEL[this.me.accessRole]) : 'Unlinked';
  }

  get role(): AccessRole | null {
    return this.me?.accessRole ?? null;
  }

  logout(): void {
    this.permissions.reset();
    this.auth.logout();
  }

  toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenu(true);
    } else {
      this.menuOpen = true;
      setTimeout(() => (this.host.nativeElement.querySelector('#top-menu input, #top-menu a') as HTMLElement | null)?.focus());
    }
  }

  closeMenu(restoreFocus: boolean): void {
    if (!this.menuOpen) {
      return;
    }
    this.menuOpen = false;
    if (restoreFocus) {
      this.menuButton?.nativeElement.focus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event): void {
    const t = e.target as HTMLElement;
    if (this.menuOpen && !t.closest('#top-menu') && !t.closest('.menu-btn')) {
      this.closeMenu(false);
    }
  }
}
