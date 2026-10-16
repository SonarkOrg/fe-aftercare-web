import { Component } from '@angular/core';
import { StaffAuth } from '../../auth/staff-auth';
import { PageTitleService } from '../../shell/page-title.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html'
})
export class LoginComponent {

  constructor(public auth: StaffAuth, titles: PageTitleService) {
    titles.set('page.login');
  }

  login() {
    this.auth.login('/dashboard');
  }

  logout() {
    this.auth.logout();
  }
}
