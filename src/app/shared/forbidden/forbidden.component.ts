import { Component } from '@angular/core';
import { Permissions } from '../../auth/permissions.service';
import { I18nService } from '../../i18n/i18n.service';
import { ROLE_LABEL } from '../../models/me.model';
import { SharedModule } from '../shared.module';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './forbidden.component.html'
})
export class ForbiddenComponent {
  constructor(private permissions: Permissions, private i18n: I18nService) {}

  get roleLabel(): string {
    const r = this.permissions.role;
    return this.i18n.t(r ? ROLE_LABEL[r] : 'auth.forbidden.unknownRole');
  }
}
