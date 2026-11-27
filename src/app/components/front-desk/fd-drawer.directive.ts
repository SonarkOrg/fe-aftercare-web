import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Behaviour of the quick-patient drawer: the first field gets the focus when it opens, Escape asks to close it
 * (and stops there, so the page does not also clear its box), and Tab stays inside it. Whoever closes the drawer gives
 * the focus back to the box (the only other element of this module that is ever focused).
 */
@Directive({ selector: '[fdDrawer]' })
export class FdDrawerDirective implements AfterViewInit {
  @Output() fdClose = new EventEmitter<void>();

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const first = this.host.nativeElement.querySelector<HTMLElement>('[data-fd-first]') ?? this.focusables()[0];
    first?.focus();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.fdClose.emit();
      return;
    }
    if (e.key !== 'Tab') {
      return;
    }
    const els = this.focusables();
    if (!els.length) {
      return;
    }
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !this.host.nativeElement.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !this.host.nativeElement.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
  }
}
