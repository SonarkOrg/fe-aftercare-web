import { registerLocaleData } from '@angular/common';
import localeEnCA from '@angular/common/locales/en-CA';
import localeFrCA from '@angular/common/locales/fr-CA';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { CORE_EN } from '../i18n/dict/core.en';
import { CORE_FR } from '../i18n/dict/core.fr';
import { PAGES_EN } from '../i18n/dict/pages.en';
import { PAGES_FR } from '../i18n/dict/pages.fr';
import { PATIENT_FILE_EN } from '../i18n/dict/patient-file.en';
import { PATIENT_FILE_FR } from '../i18n/dict/patient-file.fr';
import { I18nModule } from '../i18n/i18n.module';
import { I18nService } from '../i18n/i18n.service';
import { AnyLang, Dict, Params, TKey } from '../i18n/i18n.types';
import { ChartText, chartTextFor } from '../shared/chart-text';

registerLocaleData(localeFrCA, 'fr-CA');
registerLocaleData(localeEnCA, 'en-CA');

/** A service pre-loaded with every scope. A missing key throws, so a spec fails instead of showing a key. */
class TestI18nService extends I18nService {
  protected override onMissing(key: string): void {
    throw new Error(`[i18n] missing ${key}`);
  }
}

function load(service: I18nService, lang: AnyLang): I18nService {
  service.preload(lang, {
    core: { en: CORE_EN as unknown as Dict, fr: CORE_FR as unknown as Dict },
    patientFile: { en: PATIENT_FILE_EN as unknown as Dict, fr: PATIENT_FILE_FR as unknown as Dict },
    pages: { en: PAGES_EN as unknown as Dict, fr: PAGES_FR as unknown as Dict }
  });
  return service;
}

/** `testT('en')('chip.appt.reviewShort')`: the translation function for pure-function specs. */
export function testT(lang: AnyLang = 'en'): (key: TKey, params?: Params) => string {
  const service = load(new TestI18nService(), lang);
  return (key, params) => service.t(key, params);
}

/** The chart text of a language, for the geometry specs. */
export function testChartText(lang: AnyLang = 'en'): ChartText {
  return chartTextFor(load(new TestI18nService(), lang));
}

/** Add `I18nTestingModule.forLang()` to a spec's imports: the default language is English, so existing assertions keep working. */
@NgModule({ imports: [I18nModule], exports: [I18nModule] })
export class I18nTestingModule {
  static forLang(lang: AnyLang = 'en'): ModuleWithProviders<I18nTestingModule> {
    return {
      ngModule: I18nTestingModule,
      providers: [{ provide: I18nService, useFactory: () => load(new TestI18nService(), lang) }]
    };
  }
}
