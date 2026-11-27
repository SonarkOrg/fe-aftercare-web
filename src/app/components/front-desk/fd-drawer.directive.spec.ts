import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FdDrawerDirective } from './fd-drawer.directive';

@Component({ template: '<div fdDrawer (fdClose)="closed = closed + 1"><input id="a" data-fd-first><button id="b">b</button></div>' })
class HostComponent { closed = 0; }

describe('FdDrawerDirective', () => {
  function setup() {
    TestBed.configureTestingModule({ declarations: [HostComponent, FdDrawerDirective] });
    const f = TestBed.createComponent(HostComponent);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    return f;
  }

  it('focuses the first field, closes on Escape without letting it bubble, and keeps Tab inside', () => {
    const f = setup();
    const a = f.nativeElement.querySelector('#a') as HTMLElement;
    const b = f.nativeElement.querySelector('#b') as HTMLElement;
    expect(document.activeElement).toBe(a);
    let bubbled = false;
    document.addEventListener('keydown', () => (bubbled = true), { once: true });
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(f.componentInstance.closed).toBe(1);
    expect(bubbled).toBeFalse();
    b.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    b.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(a);
    f.nativeElement.remove();
  });
});
