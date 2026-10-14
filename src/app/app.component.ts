import { Component } from '@angular/core';
import { StaffAuth } from './auth/staff-auth';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'fe-aftercare-web';

  // Instantiate StaffAuth at startup so (in Auth0 mode) it handles the ?code=&state= callback before the '' -> /home redirect drops the query.
  constructor(_auth: StaffAuth) { }
}
