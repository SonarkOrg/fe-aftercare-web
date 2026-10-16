import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessRole } from '../../models/me.model';
import { RoleBadgeComponent } from './role-badge.component';

describe('RoleBadgeComponent', () => {
  let fixture: ComponentFixture<RoleBadgeComponent>;
  const render = (role: AccessRole | null) => {
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [RoleBadgeComponent] });
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
});
