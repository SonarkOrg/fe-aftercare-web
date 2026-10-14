import { Component } from '@angular/core';
import { StaffAuth } from '../../auth/staff-auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  constructor(public auth: StaffAuth) { }

  login() {
    this.auth.login('/dashboard');
  }

  logout() {
    this.auth.logout();
  }
}
