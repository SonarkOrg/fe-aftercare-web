import { Component, Input } from '@angular/core';
import { MeService } from '../../Services/Me.service';
import { ApiErrorsService } from '../api-errors';
import { I18nService } from '../i18n.service';
import { Lang } from '../i18n.types';

/**
 * Two buttons, Français and English. Language names are always written in their own language and never translated.
 * `profile` saves the choice on the staff member (PUT /api/me/preferences) and reloads; `local` only stores the
 * pre-login hint (login and not-staff pages) and reloads.
 */
@Component({
  selector: 'app-language-switch',
  templateUrl: './language-switch.component.html'
})
export class LanguageSwitchComponent {
  @Input() mode: 'profile' | 'local' = 'profile';
  error: string | null = null;
  busy = false;

  readonly labelId = `lang-switch-${++uid}`;

  constructor(private i18n: I18nService, private me: MeService, private errors: ApiErrorsService) {}

  get current(): Lang {
    return this.i18n.lang === 'fr' ? 'fr' : 'en';
  }

  choose(lang: Lang): void {
    if (lang === this.current || this.busy) {
      return;
    }
    this.error = null;
    if (this.mode === 'local') {
      this.i18n.setHint(lang, true);
      this.reload();
      return;
    }
    this.busy = true;
    this.me.updatePreferences(lang).subscribe({
      next: () => {
        this.i18n.setHint(lang, false);
        this.reload();
      },
      error: err => {
        this.busy = false;
        this.error = this.errors.text(err, 'lang.switch.error');
      }
    });
  }

  /** Wrapped so specs can spy on it. */
  protected reload(): void {
    window.location.reload();
  }
}

let uid = 0;
