import { Component, Input } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { buildPatientLink } from '../link.util';

@Component({
  selector: 'app-access-link',
  templateUrl: './access-link.component.html'
})
export class AccessLinkComponent {
  @Input() code = '';
  message = '';

  constructor(private i18n: I18nService) {}

  get link(): string {
    return buildPatientLink(this.code);
  }

  copy(input: HTMLInputElement): void {
    const fallback = () => {
      input.select();
      this.message = this.i18n.t('accessLink.pressCopy');
    };
    try {
      navigator.clipboard.writeText(this.link).then(() => (this.message = this.i18n.t('accessLink.copied')), fallback);
    } catch {
      fallback();
    }
  }
}
