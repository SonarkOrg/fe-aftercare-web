import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { RowMenuComponent } from './row-menu.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('RowMenuComponent', () => {
  let fixture: ComponentFixture<RowMenuComponent>;
  let el: HTMLElement;
  let picked: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang()], declarations: SHARED_DECLARATIONS }).compileComponents();
    fixture = TestBed.createComponent(RowMenuComponent);
    fixture.componentInstance.label = 'Actions for Jane';
    fixture.componentInstance.items = [{ key: 'edit', label: 'Edit' }, { key: 'remove', label: 'Remove' }];
    picked = [];
    fixture.componentInstance.selected.subscribe(k => picked.push(k));
    el = fixture.nativeElement;
    document.body.appendChild(el);
    fixture.detectChanges();
  });
  afterEach(() => el.remove());

  const btn = () => el.querySelector('.more-btn') as HTMLButtonElement;

  it('is a labelled menu button that opens and closes', () => {
    expect(btn().getAttribute('aria-label')).toBe('Actions for Jane');
    expect(btn().getAttribute('aria-haspopup')).toBe('menu');
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.row-menu')).toBeNull();
    btn().click();
    fixture.detectChanges();
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(el.querySelectorAll('[role=menuitem]')).map(i => i.textContent!.trim())).toEqual(['Edit', 'Remove']);
  });

  it('picking an item emits its key and closes', () => {
    btn().click();
    fixture.detectChanges();
    (el.querySelector('[data-key=remove]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(picked).toEqual(['remove']);
    expect(el.querySelector('.row-menu')).toBeNull();
  });

  it('Esc closes the menu and returns focus to the button; an outside click closes it too', () => {
    btn().click();
    fixture.detectChanges();
    el.querySelector('.row-menu')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.row-menu')).toBeNull();
    expect(document.activeElement).toBe(btn());
    btn().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(el.querySelector('.row-menu')).toBeNull();
  });
  it('only one menu is open at a time', () => {
    const other = TestBed.createComponent(RowMenuComponent);
    other.componentInstance.items = [{ key: 'x', label: 'X' }];
    document.body.appendChild(other.nativeElement);
    other.detectChanges();
    btn().click();
    fixture.detectChanges();
    expect(el.querySelector('.row-menu')).not.toBeNull();
    (other.nativeElement.querySelector('.more-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    other.detectChanges();
    expect(el.querySelector('.row-menu')).toBeNull();
    expect(other.nativeElement.querySelector('.row-menu')).not.toBeNull();
    other.nativeElement.remove();
  });

  it('closes when focus leaves the menu, but not when it moves between its own items', () => {
    btn().click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll<HTMLElement>('.row-menu__item'));
    items[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: items[1] }));
    fixture.detectChanges();
    expect(el.querySelector('.row-menu')).not.toBeNull();
    items[1].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    fixture.detectChanges();
    expect(el.querySelector('.row-menu')).toBeNull();
  });

  it('ArrowDown / ArrowUp move between the items and wrap', () => {
    btn().click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll<HTMLElement>('.row-menu__item'));
    const key = (k: string) => items[0].parentElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    items[0].focus();
    key('ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    key('ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    key('ArrowUp');
    expect(document.activeElement).toBe(items[1]);
    key('ArrowUp');
    expect(document.activeElement).toBe(items[0]);
  });

  it('picking an item parks focus on the menu button', () => {
    btn().click();
    fixture.detectChanges();
    (el.querySelector('[data-key=edit]') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(btn());
  });
});
