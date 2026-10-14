import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'fe-aftercare-web';

  // Instantiate AuthService at startup so it handles the Auth0 ?code=&state= callback before the '' -> /home redirect drops the query.
  constructor(_auth: AuthService) { }
}
