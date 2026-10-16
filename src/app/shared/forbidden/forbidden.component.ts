import { Component } from '@angular/core';
import { Permissions } from '../../auth/permissions.service';
import { ROLE_LABEL } from '../../models/me.model';
import { SharedModule } from '../shared.module';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './forbidden.component.html'
})
export class ForbiddenComponent {
  constructor(private permissions: Permissions) {}

  get roleLabel(): string {
    const r = this.permissions.role;
    return r ? ROLE_LABEL[r] : 'unknown role';
  }
}
