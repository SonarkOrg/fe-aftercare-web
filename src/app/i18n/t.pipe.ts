import { Pipe, PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';
import { Msg, Params, TKey } from './i18n.types';

/** `{{ 'shell.nav.dashboard' | t }}`, `{{ 'alerts.count' | t:{ count: n } }}`, `{{ msg | t }}`. Pure: the language is fixed for a page load. */
@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  constructor(private i18n: I18nService) {}

  transform(key: TKey | Msg | null | undefined, params?: Params): string {
    return key ? this.i18n.t(key, params) : '';
  }
}
