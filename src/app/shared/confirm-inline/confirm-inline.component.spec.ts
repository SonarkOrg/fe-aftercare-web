import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ConfirmInlineComponent } from './confirm-inline.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('ConfirmInlineComponent', () => {
  let fixture: ComponentFixture<ConfirmInlineComponent>;
  let component: ConfirmInlineComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang()], declarations: [ConfirmInlineComponent] }).compileComponents();
    fixture = TestBed.createComponent(ConfirmInlineComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('asks the question and emits confirmed / cancelled', () => {
    component.question = 'Remove Latex?';
    fixture.detectChanges();
    expect(el.querySelector('.confirm-inline__q')!.textContent).toBe('Remove Latex?');
    expect(el.querySelector('textarea')).toBeNull();
    const confirmed: string[] = [];
    let cancelled = 0;
    component.confirmed.subscribe(v => confirmed.push(v));
    component.cancelled.subscribe(() => cancelled++);
    (el.querySelector('.confirm-inline__ok') as HTMLButtonElement).click();
    (el.querySelector('.confirm-inline__cancel') as HTMLButtonElement).click();
    expect(confirmed).toEqual(['']);
    expect(cancelled).toBe(1);
  });

  it('with requireReason, Confirm stays disabled below the minimum and emits the trimmed reason', () => {
    component.requireReason = true;
    component.minLength = 3;
    component.maxLength = 500;
    fixture.detectChanges();
    const ok = el.querySelector('.confirm-inline__ok') as HTMLButtonElement;
    const ta = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('maxlength')).toBe('500');
    expect(ok.disabled).toBeTrue();
    ta.value = ' ab ';
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(ok.disabled).toBeTrue();
    ta.value = ' abc ';
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(ok.disabled).toBeFalse();
    const confirmed: string[] = [];
    component.confirmed.subscribe(v => confirmed.push(v));
    ok.click();
    expect(confirmed).toEqual(['abc']);
  });

  it('is disabled while busy', () => {
    component.busy = true;
    fixture.detectChanges();
    expect((el.querySelector('.confirm-inline__ok') as HTMLButtonElement).disabled).toBeTrue();
  });
  describe('focus', () => {
    it('moves into the reason field when one is required, otherwise to the confirm button', fakeAsync(() => {
      const f = TestBed.createComponent(ConfirmInlineComponent);
      document.body.appendChild(f.nativeElement);
      f.componentInstance.requireReason = true;
      f.detectChanges();
      tick();
      expect(document.activeElement).toBe(f.nativeElement.querySelector('textarea'));
      f.nativeElement.remove();
    }));

    it('Cancel gives focus back to the button that opened the confirmation', fakeAsync(() => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      const f = TestBed.createComponent(ConfirmInlineComponent);
      document.body.appendChild(f.nativeElement);
      f.detectChanges();
      tick();
      expect(document.activeElement).toBe(f.nativeElement.querySelector('.confirm-inline__ok'));
      (f.nativeElement.querySelector('.confirm-inline__cancel') as HTMLButtonElement).click();
      tick();
      expect(document.activeElement).toBe(opener);
      opener.remove();
      f.nativeElement.remove();
    }));
  });
});
