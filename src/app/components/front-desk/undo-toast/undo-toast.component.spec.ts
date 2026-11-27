import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';
import { SharedModule } from '../../../shared/shared.module';
import { TOAST_MS, ToastState, UndoToastComponent } from './undo-toast.component';

describe('UndoToastComponent', () => {
  function setup(lang: 'en' | 'fr' = 'en') {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang(lang), SharedModule], declarations: [UndoToastComponent] });
    const f = TestBed.createComponent(UndoToastComponent);
    const c = f.componentInstance;
    const events: string[] = [];
    c.undo.subscribe(() => events.push('undo'));
    c.dismissed.subscribe(() => events.push('dismissed'));
    const show = (toast: ToastState | null) => { c.toast = toast; c.ngOnChanges(); f.detectChanges(); };
    return { f, c, events, show, el: f.nativeElement as HTMLElement };
  }

  it('shows nothing without a toast, inside a polite status region', () => {
    const { f, el } = setup();
    f.detectChanges();
    expect(el.querySelector('.fd-toast')).toBeNull();
    expect(el.querySelector('[role=status]')).not.toBeNull();
  });

  it('shows the message and an undo button for an undoable toast', fakeAsync(() => {
    const { show, el, events } = setup();
    show({ id: 1, message: 'Arrival of Marie T. recorded', undoable: true });
    expect(el.querySelector('.fd-toast__text')!.textContent).toBe('Arrival of Marie T. recorded');
    const b = el.querySelector<HTMLButtonElement>('.fd-toast__undo')!;
    expect(b.textContent).toContain('Undo (Ctrl+Z)');
    b.click();
    expect(events).toEqual(['undo']);
    tick(TOAST_MS);
  }));

  it('has no button on a plain notice', fakeAsync(() => {
    const { show, el } = setup();
    show({ id: 2, message: 'Arrival undone', undoable: false });
    expect(el.querySelector('.fd-toast__undo')).toBeNull();
    tick(TOAST_MS);
  }));

  it('is dismissed after six seconds, and a new toast restarts the countdown', fakeAsync(() => {
    const { show, events } = setup();
    show({ id: 1, message: 'a', undoable: true });
    tick(TOAST_MS - 1);
    expect(events).toEqual([]);
    show({ id: 2, message: 'b', undoable: true });
    tick(TOAST_MS - 1);
    expect(events).toEqual([]);
    tick(1);
    expect(events).toEqual(['dismissed']);
  }));

  it('does not fire after it is destroyed', fakeAsync(() => {
    const { show, f, events } = setup();
    show({ id: 1, message: 'a', undoable: true });
    f.destroy();
    tick(TOAST_MS * 2);
    expect(events).toEqual([]);
  }));

  it('reads in French', fakeAsync(() => {
    const { show, el } = setup('fr');
    show({ id: 1, message: 'Arrivée de Marie T. notée', undoable: true });
    expect(el.querySelector('.fd-toast__undo')!.textContent).toContain('Annuler (Ctrl+Z)');
    tick(TOAST_MS);
  }));
});
