import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { PAGE_ROUTES } from '../pages.module';
import { I18nTestingModule } from '../../testing/i18n-testing.module';
import { PrivacyComponent } from './privacy.component';

@Component({ selector: 'app-access-log', template: '<p class="log-stub">log</p>' })
class AccessLogStubComponent {}

describe('PrivacyComponent (wave-2 contract stub)', () => {
  let fixture: ComponentFixture<PrivacyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [I18nTestingModule.forLang('fr')],
      declarations: [PrivacyComponent, AccessLogStubComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
  });

  it('shows the Vie privée title and the access log tab', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')!.textContent).toContain('Vie privée');
    expect(el.querySelector('[role=tab]')!.textContent).toContain("Journal d'accès");
    expect(el.querySelector('.log-stub')).not.toBeNull();
  });

  it('is routed at /privacy behind the AUDIT_READ permission, and /settings still needs SETTINGS_MANAGE', () => {
    const privacy = PAGE_ROUTES.find(r => r.path === 'privacy')!;
    expect(privacy.component).toBe(PrivacyComponent);
    expect(privacy.data).toEqual({ title: 'page.privacy', permission: 'AUDIT_READ' });
    expect(privacy.canActivate?.length).toBe(1);
    expect(PAGE_ROUTES.find(r => r.path === 'settings')!.data!['permission']).toBe('SETTINGS_MANAGE');
  });
});
