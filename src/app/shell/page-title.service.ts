import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { TKey } from '../i18n/i18n.types';

/** `label` is a dictionary key (route data) and is translated when it is shown. */
export interface Crumb { label: TKey; link: string }

@Injectable({ providedIn: 'root' })
export class PageTitleService {
  readonly title$ = new BehaviorSubject<string>('');
  readonly parent$ = new BehaviorSubject<Crumb | null>(null);

  constructor(private titleService: Title, private i18n: I18nService) {}

  /** Sets the title from a dictionary key. */
  set(key: TKey): void {
    this.setText(key ? this.i18n.t(key) : '');
  }

  /** Sets the title from text that is already translated or is data (a patient's name). */
  setText(text: string): void {
    this.title$.next(text);
    this.titleService.setTitle(text ? `${text} · Aftercare` : 'Aftercare');
  }

  setParent(parent: Crumb | null): void {
    this.parent$.next(parent);
  }
}
