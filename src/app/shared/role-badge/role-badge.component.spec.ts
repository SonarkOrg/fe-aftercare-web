import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessRole } from '../../models/me.model';
import { RoleBadgeComponent } from './role-badge.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('RoleBadgeComponent', () => {
  let fixture: ComponentFixture<RoleBadgeComponent>;
  const render = (role: AccessRole | null) => {
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang()], declarations: [RoleBadgeComponent] });
    fixture = TestBed.createComponent(RoleBadgeComponent);
  });

  const CASES: [AccessRole, string, string][] = [
    ['ADMIN', 'Admin', 'chip--info'],
    ['PHYSICIAN', 'Physician', 'chip--neutral'],
    ['NURSE', 'Nurse', 'chip--neutral'],
    ['RECEPTION', 'Reception', 'chip--neutral']
  ];
  for (const [role, label, cls] of CASES) {
    it(`${role}: label "${label}", aria-label, a glyph, and the ${cls} style`, () => {
      const chip = render(role).querySelector('.chip')!;
      expect(chip.querySelector('.chip__label')!.textContent).toBe(label);
      expect(chip.getAttribute('aria-label')).toBe(`Access role: ${label}`);
      expect(chip.classList).toContain(cls);
      expect(chip.classList).toContain('chip--sm');
      expect(chip.querySelector('.chip__glyph')!.getAttribute('aria-hidden')).toBe('true');
      expect(chip.querySelector('.chip__glyph')!.textContent!.trim().length).toBe(1); // status = glyph + word
    });
  }

  it('shows nothing without a role', () => {
    expect(render(null).querySelector('.chip')).toBeNull();
  });

  it('in French: the epicene labels and an aria-label with a no-break space', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ declarations: [RoleBadgeComponent], imports: [I18nTestingModule.forLang('fr')] });
    const f = TestBed.createComponent(RoleBadgeComponent);
    f.componentRef.setInput('role', 'RECEPTION');
    f.detectChanges();
    const chip = f.nativeElement.querySelector('.role-badge') as HTMLElement;
    expect(chip.getAttribute('aria-label')).toBe('Rôle d\'accès\u00a0: Accueil');
    expect(chip.textContent).toContain('Accueil');
    f.componentRef.setInput('role', 'NURSE');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Soins infirmiers');
  });
});
