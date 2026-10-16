import { TestBed } from '@angular/core/testing';
import '../testing/i18n-testing.module';
import { I18nService } from './i18n.service';
import { Dict } from './i18n.types';

describe('I18nService', () => {
  let service: I18nService;
  const KEY = 'aftercare.staffLang';

  beforeEach(() => {
    localStorage.removeItem(KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
  });
  afterEach(() => {
    localStorage.removeItem(KEY);
    document.documentElement.lang = 'en';
  });

  describe('boot', () => {
    it('no hint: French', async () => {
      await service.boot();
      expect(service.lang).toBe('fr');
      expect(service.t('shell.nav.dashboard')).toBe('Tableau de bord');
      expect(document.documentElement.lang).toBe('fr-CA');
    });

    it('a hint of en: English', async () => {
      service.setHint('en', false);
      await service.boot();
      expect(service.lang).toBe('en');
      expect(service.t('shell.nav.dashboard')).toBe('Dashboard');
      expect(document.documentElement.lang).toBe('en-CA');
    });

    it('an invalid hint is ignored', async () => {
      localStorage.setItem(KEY, '{"lang":"de"}');
      await service.boot();
      expect(service.lang).toBe('fr');
    });

    it('a throwing localStorage still gives French', async () => {
      spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
      await service.boot();
      expect(service.lang).toBe('fr');
    });

    it('never reads navigator.language', async () => {
      const lang = spyOnProperty(navigator, 'language', 'get').and.returnValue('en-US');
      await service.boot();
      expect(service.lang).toBe('fr');
      expect(lang).not.toHaveBeenCalled();
    });
  });

  it('use() loads the language and sets html lang', async () => {
    await service.use('en');
    expect(service.lang).toBe('en');
    expect(service.locale).toBe('en-CA');
    expect(document.documentElement.lang).toBe('en-CA');
    await service.use('fr');
    expect(service.t('common.cancel')).toBe('Annuler');
  });

  describe('t', () => {
    beforeEach(async () => service.use('fr'));

    it('interpolates and formats numbers in the locale', () => {
      service.extend('fr', { 'x.count': 'Total : {count}', 'x.name': 'Bonjour {name}' });
      expect(service.t('x.count' as never, { count: 1234 })).toBe('Total : 1 234'.replace(' ', ' '));
      expect(service.t('x.name' as never, { name: '<b>Jean</b>' })).toBe('Bonjour <b>Jean</b>');
    });

    it('plurals: French treats 0 and 1 as one, English 0 as other', async () => {
      const entry = { zero: 'Aucune', one: '{count} alerte', other: '{count} alertes' };
      service.extend('fr', { 'x.plural': entry, 'x.plural2': { one: '{count} alerte', other: '{count} alertes' } } as Dict);
      expect(service.t('x.plural' as never, { count: 0 })).toBe('Aucune');
      expect(service.t('x.plural2' as never, { count: 0 })).toBe('0 alerte');
      expect(service.t('x.plural2' as never, { count: 1 })).toBe('1 alerte');
      expect(service.t('x.plural2' as never, { count: 2 })).toBe('2 alertes');
      await service.use('en');
      service.extend('en', { 'x.p': { one: '{count} alert', other: '{count} alerts' } } as Dict);
      expect(service.t('x.p' as never, { count: 0 })).toBe('0 alerts');
      expect(service.t('x.p' as never, { count: 1 })).toBe('1 alert');
    });

    it('a missing key returns the key and logs it', () => {
      const error = spyOn(console, 'error');
      expect(service.t('no.such.key' as never)).toBe('no.such.key');
      expect(error).toHaveBeenCalledWith('[i18n] missing', 'no.such.key');
    });

    it('a Msg object is translated with its params', () => {
      expect(service.t({ key: 'dashboard.seg.received', params: { count: 3 } })).toBe('3 reçus');
    });
  });

  it('falls back to the English entry when French lacks the key', async () => {
    await service.use('fr');
    service.extend('en', { 'only.en': 'English only' });
    expect(service.t('only.en' as never)).toBe('English only');
  });

  it('a registered scope is resolvable', async () => {
    await service.use('fr');
    expect(service.has('pd.tab.overview')).toBeFalse();
    service.register('patientFile', { en: { 'pd.tab.overview': 'Overview' }, fr: { 'pd.tab.overview': 'Sommaire' } });
    expect(service.t('pd.tab.overview')).toBe('Sommaire');
  });
});
