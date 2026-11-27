import { TestBed } from '@angular/core/testing';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';
import { SharedModule } from '../../../shared/shared.module';
import { ArrivalBoxComponent, BoxKey } from './arrival-box.component';

describe('ArrivalBoxComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang('en'), SharedModule], declarations: [ArrivalBoxComponent] });
    const f = TestBed.createComponent(ArrivalBoxComponent);
    f.detectChanges();
    const input = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#arrival-box')!;
    const keys: BoxKey[] = [];
    const texts: string[] = [];
    const undos: KeyboardEvent[] = [];
    f.componentInstance.key.subscribe(k => keys.push(k));
    f.componentInstance.valueChange.subscribe(v => texts.push(v));
    f.componentInstance.undoKey.subscribe(e => undos.push(e));
    const press = (key: string, init: KeyboardEventInit = {}) => {
      const e = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...init });
      input.dispatchEvent(e);
      return e;
    };
    return { f, input, keys, texts, undos, press };
  }

  it('is a plain text field that never stores or suggests anything', () => {
    const { input } = setup();
    expect(input.type).toBe('text');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('autocapitalize')).toBe('characters');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('inputmode')).toBe('text');
    expect(input.name).toBe('');
  });

  it('emits the typed text', () => {
    const { input, texts } = setup();
    input.value = 'trem';
    input.dispatchEvent(new Event('input'));
    expect(texts).toEqual(['trem']);
  });

  it('maps arrows and Enter, and prevents the default of those keys only', () => {
    const { keys, press } = setup();
    expect(press('ArrowDown').defaultPrevented).toBeTrue();
    expect(press('ArrowUp').defaultPrevented).toBeTrue();
    expect(press('Enter').defaultPrevented).toBeTrue();
    expect(press('Enter', { shiftKey: true }).defaultPrevented).toBeTrue();
    expect(press('a').defaultPrevented).toBeFalse();
    expect(keys).toEqual(['down', 'up', 'enter', 'shiftEnter']);
  });

  it('hands Ctrl+Z and ⌘Z to the page without preventing the default itself', () => {
    const { undos, press, keys } = setup();
    expect(press('z', { ctrlKey: true }).defaultPrevented).toBeFalse();
    expect(press('Z', { metaKey: true }).defaultPrevented).toBeFalse();
    expect(undos.length).toBe(2);
    expect(keys).toEqual([]);
  });

  it('ignores Shift+Ctrl+Z (redo), other Ctrl combinations and composition', () => {
    const { undos, keys, press } = setup();
    press('z', { ctrlKey: true, shiftKey: true });
    press('Enter', { ctrlKey: true });
    press('Enter', { isComposing: true });
    expect(undos).toEqual([]);
    expect(keys).toEqual([]);
  });

  it('focus() and clear() act on the field itself', () => {
    const { f, input } = setup();
    document.body.appendChild(f.nativeElement);
    f.componentInstance.focus();
    expect(document.activeElement).toBe(input);
    expect(f.componentInstance.focused).toBeTrue();
    input.value = 'abc';
    f.componentInstance.clear();
    expect(input.value).toBe('');
    f.nativeElement.remove();
  });
});
