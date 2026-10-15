import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subscription, filter, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertCountService } from '../Services/AlertCount.service';
import { StaffAuth } from '../auth/staff-auth';
import { IconName } from '../shared/icon/icon.component';
import { PageTitleService } from './page-title.service';

interface NavItem { label: string; link: string; icon: IconName; badge?: boolean }

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css'
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly items: NavItem[] = [
    { label: 'Dashboard', link: '/dashboard', icon: 'dashboard' },
    { label: 'Patients', link: '/patients', icon: 'users' },
    { label: 'Appointments', link: '/appointments', icon: 'calendar' },
    { label: 'Alerts', link: '/alerts', icon: 'bell', badge: true },
    { label: 'Forms', link: '/questionnaires', icon: 'file' }
  ];
  devAuth = environment.devAuth;
  menuOpen = false;
  searchTerm = '';
  userName$: Observable<string | null>;
  initials$: Observable<string>;

  @ViewChild('main', { static: true }) main!: ElementRef<HTMLElement>;
  @ViewChild('menuButton') menuButton?: ElementRef<HTMLButtonElement>;

  private sub = new Subscription();
  private lastPath: string | null = null;

  constructor(
    private router: Router,
    private auth: StaffAuth,
    public titles: PageTitleService,
    public alertCount: AlertCountService,
    private host: ElementRef<HTMLElement>
  ) {
    this.userName$ = auth.userName$;
    this.initials$ = auth.userName$.pipe(map(n => (n ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')));
  }

  ngOnInit(): void {
    this.alertCount.refresh();
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
      this.closeMenu(false);
      if (!first) {
        this.main.nativeElement.focus({ preventScroll: true });
      }
    }));
    this.applyRouteData();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private applyRouteData(): void {
    let snap = this.router.routerState.snapshot.root;
    while (snap.firstChild) {
      snap = snap.firstChild;
    }
    const data = snap.data as { title?: string; parent?: { label: string; link: string } };
    if (data.title) {
      this.titles.set(data.title);
    }
    this.titles.setParent(data.parent ?? null);
  }

  badgeLabel(item: NavItem, n: number): string | null {
    return item.badge && n > 0 ? `${item.label}, ${n} open` : null;
  }

  search(): void {
    const q = this.searchTerm.trim();
    this.router.navigate(['/patients'], { queryParams: q ? { q } : {} });
    this.closeMenu(false);
  }

  logout(): void {
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
