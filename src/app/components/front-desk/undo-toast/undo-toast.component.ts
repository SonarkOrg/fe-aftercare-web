import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';

export interface ToastState {
  id: number; message: string; undoable: boolean;
  /** Extra lines under the message (expiry question, family arrivals). */
  lines?: string[];
  /** How long it stays; the default is 6 seconds, a toast that asks something stays longer. */
  ms?: number;
}

/** How long the toast stays (spec: 6 seconds). */
export const TOAST_MS = 6000;

/** The "arrival noted · undo" notice. The page owns the state; this component only shows it and times it out. */
@Component({
  selector: 'app-undo-toast',
  templateUrl: './undo-toast.component.html'
})
export class UndoToastComponent implements OnChanges, OnDestroy {
  @Input() toast: ToastState | null = null;
  @Output() undo = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(): void {
    this.clear();
    if (this.toast) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.dismissed.emit();
      }, this.toast.ms ?? TOAST_MS);
    }
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
