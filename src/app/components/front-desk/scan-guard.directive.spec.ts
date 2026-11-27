import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DeskCardBus, ScanGuardDirective } from './scan-guard.directive';

@Component({ template: '<input id="g" fdScanGuard [(ngModel)]="v" name="v"><div fdScanGuard><button id="b" type="button" (click)="clicks = clicks + 1">Oui</button></div>' })
class HostComponent { v = 'old'; clicks = 0; }

describe('ScanGuardDirective', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [FormsModule], declarations: [HostComponent, ScanGuardDirective], providers: [DeskCardBus] });
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const input = f.nativeElement.querySelector('#g') as HTMLInputElement;
    const seen: string[] = [];
    TestBed.inject(DeskCardBus).scanned.subscribe(n => seen.push(n));
    return { f, input, seen };
  }
  function type(input: HTMLInputElement, text: string): void {
    for (const ch of text) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      input.value += ch;
      input.dispatchEvent(new Event('input'));
    }
  }

  it('cancels the Enter of a burst, restores the previous value and hands the number over', async () => {
    const { f, input, seen } = setup();
    await f.whenStable();
    type(input, 'ROYS85522712');
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    expect(e.defaultPrevented).toBeTrue();
    expect(input.value).toBe('old');
    expect(f.componentInstance.v).toBe('old');
    expect(seen).toEqual(['ROYS85522712']);
    const again = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(again); // ignored for 100 ms after a burst
    expect(again.defaultPrevented).toBeTrue();
    f.nativeElement.remove();
  });

  it('leaves a short or slow entry alone', () => {
    const { f, input, seen } = setup();
    type(input, 'abc');
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    expect(e.defaultPrevented).toBeFalse();
    expect(seen).toEqual([]);
    f.nativeElement.remove();
  });

  function typeKeys(el: HTMLElement, text: string): void {
    for (const ch of text) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
    }
  }

  it('guards a focused button inside a guarded container: the Enter presses nothing and the number is handed over', () => {
    const { f, seen } = setup();
    const btn = f.nativeElement.querySelector('#b') as HTMLButtonElement;
    typeKeys(btn, 'ROYS85522712');
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    btn.dispatchEvent(e);
    expect(e.defaultPrevented).toBeTrue();
    expect(seen).toEqual(['ROYS85522712']);
    f.nativeElement.remove();
  });

  it('treats a burst followed by Tab (scanner Tab suffix) like one followed by Enter', async () => {
    const { f, input, seen } = setup();
    await f.whenStable();
    type(input, 'ROYS85522712');
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    expect(e.defaultPrevented).toBeTrue();
    expect(input.value).toBe('old');
    expect(seen).toEqual(['ROYS85522712']);
    f.nativeElement.remove();
  });

  it('leaves an ordinary Tab alone', () => {
    const { f, input } = setup();
    type(input, 'ab');
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(e);
    expect(e.defaultPrevented).toBeFalse();
    f.nativeElement.remove();
  });
});
