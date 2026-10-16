import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nTestingModule } from '../testing/i18n-testing.module';

@Component({
  template: `<p id="a">{{ 'common.cancel' | t }}</p><p id="b">{{ msg | t }}</p><p id="c">{{ 'dashboard.seg.received' | t:{ count: 3 } }}</p>
    <p id="d">{{ 'alerts.shown' | t:{ count: 1 } }}</p><p id="e">{{ 'alerts.shown' | t:{ count: 2 } }}</p><p id="f">{{ 'RETIRED' | enumLabel:'questionnaireStatus' }}</p>`
})
class HostComponent {
  msg = { key: 'status.reason.highOpen' as const, params: { count: 2 } };
}

describe('TPipe', () => {
  function render(lang: 'fr' | 'en') {
    TestBed.configureTestingModule({ declarations: [HostComponent], imports: [I18nTestingModule.forLang(lang)] });
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    return (id: string) => (f.nativeElement.querySelector('#' + id) as HTMLElement).textContent;
  }

  it('translates keys, Msg objects, params and plurals in French', () => {
    const text = render('fr');
    expect(text('a')).toBe('Annuler');
    expect(text('b')).toBe('2 alertes élevées ouvertes');
    expect(text('c')).toBe('3 reçus');
    expect(text('d')).toBe('1 alerte affichée');
    expect(text('e')).toBe('2 alertes affichées');
    expect(text('f')).toBe('Retiré');
  });

  it('and in English', () => {
    const text = render('en');
    expect(text('a')).toBe('Cancel');
    expect(text('b')).toBe('2 high alerts open');
    expect(text('d')).toBe('1 alert shown');
  });
});
