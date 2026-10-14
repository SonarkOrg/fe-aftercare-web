import { Component, Input } from '@angular/core';
import { buildPatientLink } from '../link.util';

@Component({
  selector: 'app-access-link',
  templateUrl: './access-link.component.html'
})
export class AccessLinkComponent {
  @Input() code = '';
  message = '';

  get link(): string {
    return buildPatientLink(this.code);
  }

  copy(input: HTMLInputElement): void {
    const fallback = () => {
      input.select();
      this.message = 'Press Ctrl+C to copy';
    };
    try {
      navigator.clipboard.writeText(this.link).then(() => (this.message = 'Copied'), fallback);
    } catch {
      fallback();
    }
  }
}
