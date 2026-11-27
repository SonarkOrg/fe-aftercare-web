import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

export type BoxKey = 'up' | 'down' | 'enter' | 'shiftEnter' | 'tab';

/**
 * The one input of the Arrivals page. Its text lives only in this field and in the parent's `query`: never in the URL,
 * `localStorage` or the title. The only `.focus()` in the front-desk module is the one below.
 */
@Component({
  selector: 'app-arrival-box',
  templateUrl: './arrival-box.component.html'
})
export class ArrivalBoxComponent {
  @Input() value = '';
  /** Translated placeholder; empty means the default one. */
  @Input() placeholder = '';
  /** While the walk-in panel is open, Tab changes the visit type instead of moving the focus. */
  @Input() captureTab = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() key = new EventEmitter<BoxKey>();
  /** Ctrl+Z / ⌘Z: the page decides whether to call `preventDefault()` (only with an empty box and a visible toast). */
  @Output() undoKey = new EventEmitter<KeyboardEvent>();
  @ViewChild('input', { static: true }) input!: ElementRef<HTMLInputElement>;

  focus(): void {
    this.input.nativeElement.focus();
  }

  /** Empties the field itself, not only the bound value (the bound value can already be ''). */
  clear(): void {
    this.input.nativeElement.value = '';
  }

  get focused(): boolean {
    return document.activeElement === this.input.nativeElement;
  }

  onInput(text: string): void {
    this.valueChange.emit(text);
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.isComposing) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
      this.undoKey.emit(e);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this.key.emit('down'); break;
      case 'ArrowUp': e.preventDefault(); this.key.emit('up'); break;
      case 'Enter': e.preventDefault(); this.key.emit(e.shiftKey ? 'shiftEnter' : 'enter'); break;
      case 'Tab':
        if (this.captureTab && !e.shiftKey) {
          e.preventDefault();
          this.key.emit('tab');
        }
        break;
      default: break;
    }
  }
}
