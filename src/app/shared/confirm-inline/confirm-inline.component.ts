import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';

let nextId = 0;

/** Tiny inline confirmation: "Remove X? [Remove] [Cancel]", with an optional required reason. */
@Component({
  selector: 'app-confirm-inline',
  template: `<div class="confirm-inline" role="group" [attr.aria-label]="question">
  <p class="confirm-inline__q">{{ question }}</p>
  <div class="form-group" *ngIf="requireReason">
    <label [attr.for]="uid">{{ reasonLabel }}</label>
    <textarea #ta [id]="uid" rows="2" [attr.maxlength]="maxLength" [value]="reason" (input)="reason = ta.value" [attr.aria-describedby]="uid + '-h'"></textarea>
    <span class="helper-line confirm-inline__h" [id]="uid + '-h'">{{ minLength }}–{{ maxLength }} characters.</span>
  </div>
  <div class="btn-row">
    <button type="button" class="btn btn--danger btn--sm confirm-inline__ok" [disabled]="busy || (requireReason && reason.trim().length < minLength)" (click)="confirm()">{{ confirmLabel }}</button>
    <button type="button" class="btn btn--secondary btn--sm confirm-inline__cancel" (click)="cancel()">Cancel</button>
  </div>
</div>`
})
export class ConfirmInlineComponent implements AfterViewInit {
  @Input() question = 'Remove this item?';
  @Input() confirmLabel = 'Remove';
  @Input() requireReason = false;
  @Input() reasonLabel = 'Reason';
  @Input() minLength = 3;
  @Input() maxLength = 500;
  @Input() busy = false;
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  readonly uid = `confirm-reason-${++nextId}`;
  reason = '';
  /** What had focus when the confirmation opened (the button that asked): Cancel gives focus back to it. */
  private opener = document.activeElement as HTMLElement | null;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('textarea, .confirm-inline__ok')?.focus());
  }

  cancel(): void {
    this.cancelled.emit();
    const opener = this.opener;
    setTimeout(() => {
      if (opener && opener !== document.body && opener.isConnected) {
        opener.focus();
      }
    });
  }

  confirm(): void {
    this.confirmed.emit(this.reason.trim());
  }
}
