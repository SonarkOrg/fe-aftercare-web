import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { Subject, Subscription } from 'rxjs';

export interface RowMenuItem { key: string; label: string }

/** Emits the menu that just opened, so any other open menu closes: only one is open at a time. */
const opened$ = new Subject<RowMenuComponent>();

/** The "more" button of a row with a small menu (Edit, Remove, ...). Esc, outside clicks and leaving it with Tab close it; Up/Down move between items. */
@Component({
  selector: 'app-row-menu',
  template: `<span class="row-menu-wrap">
  <button #btn type="button" class="chev more-btn" aria-haspopup="menu" [attr.aria-expanded]="open" [attr.aria-label]="label" (click)="toggle($event)">
    <app-icon name="more-horizontal" [size]="16"></app-icon>
  </button>
  <div class="row-menu" role="menu" *ngIf="open" [attr.aria-label]="label">
    <button type="button" role="menuitem" class="row-menu__item" *ngFor="let i of items" [attr.data-key]="i.key" (click)="pick(i)">{{ i.label }}</button>
  </div>
</span>`
})
export class RowMenuComponent implements OnDestroy {
  @Input() label = 'Actions';
  @Input() items: RowMenuItem[] = [];
  @Output() selected = new EventEmitter<string>();
  open = false;

  @ViewChild('btn') btn?: ElementRef<HTMLButtonElement>;

  private sub: Subscription;

  constructor(private host: ElementRef<HTMLElement>) {
    this.sub = opened$.subscribe(m => {
      if (m !== this) {
        this.open = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(e: Event): void {
    e.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      opened$.next(this);
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.row-menu__item')?.focus());
    }
  }

  pick(i: RowMenuItem): void {
    this.open = false;
    // the item is about to disappear: park focus on the button so whatever opens next (a drawer, a confirmation) can return here
    this.btn?.nativeElement.focus();
    this.selected.emit(i.key);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.open && !this.host.nativeElement.contains(e.target as Node)) {
      this.open = false;
    }
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(e: FocusEvent): void {
    const to = e.relatedTarget as Node | null;
    if (this.open && to && !this.host.nativeElement.contains(to)) {
      this.open = false;
    }
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) {
      return;
    }
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.row-menu__item'));
    if (!items.length) {
      return;
    }
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at <= 0 ? items.length - 1 : at - 1);
    items[next].focus();
  }

  @HostListener('keydown.escape')
  onEsc(): void {
    if (this.open) {
      this.open = false;
      this.btn?.nativeElement.focus();
    }
  }
}
