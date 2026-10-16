import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { me } from '../../testing/fixtures';
import { I18nTestingModule } from '../../testing/i18n-testing.module';
import { I18nService } from '../i18n.service';
import { LanguageSwitchComponent } from './language-switch.component';

class Testable extends LanguageSwitchComponent {
  reloads = 0;
  protected override reload(): void { this.reloads++; }
}

describe('LanguageSwitchComponent', () => {
  let fixture: ComponentFixture<Testable>;
  let http: HttpTestingController;
  let i18n: I18nService;
  let el: HTMLElement;

  function setup(mode: 'profile' | 'local', lang: 'fr' | 'en' = 'fr') {
    localStorage.removeItem('aftercare.staffLang');
    TestBed.configureTestingModule({ declarations: [Testable], imports: [I18nTestingModule.forLang(lang), HttpClientTestingModule] });
    fixture = TestBed.createComponent(Testable);
    fixture.componentInstance.mode = mode;
    http = TestBed.inject(HttpTestingController);
    i18n = TestBed.inject(I18nService);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }
  const btn = (lang: string) => el.querySelector<HTMLButtonElement>(`button[lang="${lang}-CA"]`)!;

  it('names each language in its own language, with a lang attribute, and marks the current one', () => {
    setup('profile');
    expect(btn('fr').textContent).toBe('Français');
    expect(btn('en').textContent).toBe('English');
    expect(btn('fr').getAttribute('aria-pressed')).toBe('true');
    expect(btn('en').getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('[role=group]')!.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('profile mode: saves the preference, remembers it and reloads', () => {
    setup('profile');
    btn('en').click();
    const req = http.expectOne(`${environment.apiUrl}/me/preferences`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ uiLanguage: 'EN' });
    expect(fixture.componentInstance.reloads).toBe(0);
    req.flush(me('NURSE', { uiLanguage: 'EN' }));
    expect(i18n.readHint()).toEqual({ lang: 'en', explicit: false });
    expect(fixture.componentInstance.reloads).toBe(1);
  });

  it('profile mode: an error shows a banner and does not reload', () => {
    setup('profile');
    btn('en').click();
    http.expectOne(`${environment.apiUrl}/me/preferences`).flush({ status: 403, error: 'NOT_STAFF', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el.querySelector('.banner--error')!.textContent).toContain('Votre connexion n\'est liée à aucun membre actif du personnel.');
    expect(fixture.componentInstance.reloads).toBe(0);
  });

  it('clicking the current language does nothing', () => {
    setup('profile');
    btn('fr').click();
    http.expectNone(`${environment.apiUrl}/me/preferences`);
    expect(fixture.componentInstance.reloads).toBe(0);
  });

  it('local mode: no request, an explicit hint and a reload', () => {
    setup('local');
    btn('en').click();
    http.expectNone(`${environment.apiUrl}/me/preferences`);
    expect(i18n.readHint()).toEqual({ lang: 'en', explicit: true });
    expect(fixture.componentInstance.reloads).toBe(1);
  });
});
