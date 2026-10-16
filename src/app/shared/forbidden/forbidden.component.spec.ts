import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AccessRole } from '../../models/me.model';
import { providePermissions } from '../../testing/fixtures';
import { ForbiddenComponent } from './forbidden.component';
import { I18nTestingModule } from '../../testing/i18n-testing.module';

describe('ForbiddenComponent', () => {
  function render(role: AccessRole | null): HTMLElement {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang(), ForbiddenComponent, RouterTestingModule], providers: [providePermissions(role)] });
    const fixture: ComponentFixture<ForbiddenComponent> = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('says "No access" with the role label and where to go', () => {
    const el = render('RECEPTION');
    expect(el.querySelector('h1')!.textContent).toBe('No access');
    expect(el.textContent).toContain("Your role (Reception) doesn't include this page. Ask a clinic administrator if you need access.");
    const link = el.querySelector('a')!;
    expect(link.textContent).toBe('Back to dashboard');
    expect(link.getAttribute('href')).toBe('/dashboard');
  });

  for (const [role, label] of [['ADMIN', 'Admin'], ['PHYSICIAN', 'Physician'], ['NURSE', 'Nurse']] as [AccessRole, string][]) {
    it(`names the ${role} role`, () => {
      TestBed.resetTestingModule();
      expect(render(role).textContent).toContain(`Your role (${label})`);
    });
  }
});
