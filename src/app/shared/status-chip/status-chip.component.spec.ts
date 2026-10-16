import { TestBed } from '@angular/core/testing';
import { StatusChipComponent } from './status-chip.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('StatusChipComponent', () => {
  function render(size?: 'sm') {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang()], declarations: [StatusChipComponent] });
    const f = TestBed.createComponent(StatusChipComponent);
    f.componentRef.setInput('spec', { tone: 'critical', glyph: '▲', label: { key: 'enum.patientStatus.CRITICAL' } });
    if (size) {
      f.componentRef.setInput('size', size);
    }
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('hides the glyph from assistive tech and shows the label', () => {
    const el = render();
    expect(el.querySelector('.chip__glyph')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.chip__glyph')!.textContent).toBe('▲');
    expect(el.querySelector('.chip__label')!.textContent).toBe('Critical');
  });

  it('applies the tone class, and the sm size only when asked', () => {
    const chip = render('sm').querySelector('.chip')!;
    expect(chip.classList).toContain('chip--critical');
    expect(chip.classList).toContain('chip--sm');
  });

  it('is medium by default', () => {
    expect(render().querySelector('.chip')!.classList).not.toContain('chip--sm');
  });
});
