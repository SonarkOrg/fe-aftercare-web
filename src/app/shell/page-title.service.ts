import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

export interface Crumb { label: string; link: string }

@Injectable({ providedIn: 'root' })
export class PageTitleService {
  readonly title$ = new BehaviorSubject<string>('');
  readonly parent$ = new BehaviorSubject<Crumb | null>(null);

  constructor(private titleService: Title) {}

  set(title: string): void {
    this.title$.next(title);
    this.titleService.setTitle(title ? `${title} · Aftercare` : 'Aftercare');
  }

  setParent(parent: Crumb | null): void {
    this.parent$.next(parent);
  }
}
