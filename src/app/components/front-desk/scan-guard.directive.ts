import { Directive, ElementRef, HostListener, Injectable, Optional } from '@angular/core';
import { Subject } from 'rxjs';
import { extractNam } from '../../shared/ramq.util';
import { isBurst } from './scan-input';

/**
 * Where a card number caught by a guarded field goes: the Arrivals page subscribes and treats it exactly like a card read
 * in the box (`pendingCard`). Provided by the page, so the number never travels through a service that outlives it.
 */
@Injectable()
export class DeskCardBus {
  readonly scanned = new Subject<string>();
}

/** A pause longer than this starts a new burst window. */
const PAUSE_MS = 250;
/** Enter is ignored for this long after a burst. */
const AFTER_BURST_MS = 100;

/**
 * On every input and select of the front-desk module except the box (D35), and on the containers of the drawer, the fix
 * panel, the walk-in panel and the rows, so a focused BUTTON (consent pills, « ⇄ », « Retirer », the row chevron) is
 * guarded too. A scanner types the card number and an Enter (or a Tab) into whatever has the focus: this directive cancels
 * that Enter/Tab (no form submit, no button press, no focus move), puts a field's previous value back and hands the number
 * to the box flow. It never moves the focus. Nested guards are fine: the innermost one handles the burst and stops it.
 */
@Directive({ selector: '[fdScanGuard]' })
export class ScanGuardDirective {
  private times: number[] = [];
  private typed = '';
  private target: EventTarget | null = null;
  private startValue = '';
  private blockUntil = 0;

  constructor(private host: ElementRef<HTMLElement>, @Optional() private bus: DeskCardBus | null) {}

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    const now = Date.now();
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      this.onEnd(e, now);
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const last = this.times[this.times.length - 1];
    if (last === undefined || now - last > PAUSE_MS || e.target !== this.target) {
      this.times = [];
      this.typed = '';
      this.target = e.target;
      this.startValue = fieldOf(e.target)?.value ?? '';
    }
    this.times.push(now);
    this.typed += e.key;
    if (!fieldOf(e.target)) {
      // a button or another non-text element: the characters do nothing there, Space would press it
      if (e.key === ' ') {
        e.preventDefault();
      }
    }
  }

  private onEnd(e: KeyboardEvent, now: number): void {
    if (now < this.blockUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!isBurst(this.times) || e.target !== this.target) {
      this.times = [];
      this.typed = '';
      return;
    }
    // a burst: whatever it was, this Enter/Tab belongs to the scanner and submits, presses or moves nothing
    e.preventDefault();
    e.stopPropagation();
    this.blockUntil = now + AFTER_BURST_MS;
    const field = fieldOf(e.target);
    const nam = extractNam(field ? field.value : this.typed);
    this.times = [];
    this.typed = '';
    if (nam) {
      if (field) {
        field.value = this.startValue;
        field.dispatchEvent(new Event('input', { bubbles: true })); // the bound model gets its old value back
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      this.bus?.scanned.next(nam);
    }
  }
}

/** The text field (input, textarea) or select an event came from, else null (a button, a container). */
function fieldOf(t: EventTarget | null): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  return t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement ? t : null;
}
