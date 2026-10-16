import { Component, Inject, OnInit, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { DEV_IDENTITY_UI } from '../../auth/dev-identity';
import { Permissions } from '../../auth/permissions.service';
import { StaffAuth } from '../../auth/staff-auth';
import { I18nService } from '../../i18n/i18n.service';
import { apiErrorOf } from '../../models/api-error.model';
import { environment } from '../../../environments/environment';
import { PageTitleService } from '../../shell/page-title.service';
import { SharedModule } from '../shared.module';

@Component({
  selector: 'app-not-staff',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './not-staff.component.html'
})
export class NotStaffComponent implements OnInit {
  subject$: Observable<string | null>;
  devAuth = environment.devAuth;
  message = '';
  busy = false;

  constructor(
    private auth: StaffAuth,
    private permissions: Permissions,
    private router: Router,
    private i18n: I18nService,
    titles: PageTitleService,
    @Optional() @Inject(DEV_IDENTITY_UI) public devUi: unknown
  ) {
    this.subject$ = auth.subject$;
    titles.set('page.notLinked');
  }

  ngOnInit(): void {
    // Make sure the dev token (and so the sub) exists even when nothing else asked for it yet.
    this.auth.getAccessToken().subscribe({ error: () => { /* the sub just stays empty */ } });
  }

  copy(sub: string): void {
    try {
      navigator.clipboard.writeText(sub).then(() => (this.message = this.i18n.t('auth.notStaff.copied')), () => (this.message = this.i18n.t('auth.notStaff.copyManual')));
    } catch {
      this.message = this.i18n.t('auth.notStaff.copyManual');
    }
  }

  tryAgain(): void {
    this.busy = true;
    this.message = '';
    this.permissions.load(true).subscribe({
      next: () => {
        this.busy = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: err => {
        this.busy = false;
        this.message = apiErrorOf(err)?.error === 'NOT_STAFF'
          ? this.i18n.t('auth.notStaff.stillNotLinked')
          : this.i18n.t('auth.notStaff.checkFailed');
      }
    });
  }

  logout(): void {
    this.permissions.reset();
    this.auth.logout();
  }
}
