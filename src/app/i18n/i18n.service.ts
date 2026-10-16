import { formatNumber, registerLocaleData } from '@angular/common';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { pseudo } from './pseudo';
import { AnyLang, Dict, Entry, HTML_LANG, LOCALE, Lang, Msg, Params, PluralEntry, Scope, TKey } from './i18n.types';

const HINT_KEY = 'aftercare.staffLang';

// Literal import() calls so the bundler creates one chunk per language. No dictionary is in the initial bundle.
const CORE = {
  fr: () => import('./dict/core.fr').then(m => m.CORE_FR as Dict),
  en: () => import('./dict/core.en').then(m => m.CORE_EN as Dict)
};
const LOCALE_DATA: Record<Lang, () => Promise<unknown[]>> = {
  fr: () => import('@angular/common/locales/fr-CA').then(m => m.default),
  en: () => import('@angular/common/locales/en-CA').then(m => m.default)
};

export interface LangHint { lang: Lang; explicit: boolean }

export function isLang(v: unknown): v is Lang {
  return v === 'fr' || v === 'en';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private current: AnyLang = 'fr';
  /** Dictionaries per scope and language. 'core' holds only the boot language. */
  private scopes: Partial<Record<Scope, Partial<Record<AnyLang, Dict>>>> = {};
  private merged: Map<string, Entry> = new Map();
  private fallback: Map<string, Entry> = new Map();
  private rules = new Map<string, Intl.PluralRules>();

  get lang(): AnyLang { return this.current; }
  get locale(): string { return LOCALE[this.current]; }
  /** 'fr' | 'en' for formatting helpers (pseudo formats as English). */
  get fmtLang(): AnyLang { return this.current; }

  /** APP_INITIALIZER: lang = hint ?? 'fr'; loads core and the locale data; sets html lang. Never reads navigator.language. */
  async boot(): Promise<void> {
    if (typeof location !== 'undefined' && location.pathname.startsWith('/q/')) {
      return; // the patient page has its own dictionaries and language state
    }
    let lang: AnyLang = this.readHint()?.lang ?? 'fr';
    if (!environment.production && environment.devAuth && typeof location !== 'undefined' && /[?&]pseudo=1\b/.test(location.search)) {
      lang = 'pseudo';
    }
    await this.use(lang);
  }

  /** Loads core for `lang` (and its locale data), re-registers loaded scopes, sets the language and html lang. */
  async use(lang: AnyLang): Promise<void> {
    const dictLang: Lang = lang === 'fr' ? 'fr' : 'en';
    let core: Dict | undefined;
    let loaded: Lang = dictLang;
    try {
      [core] = await Promise.all([this.retry(CORE[dictLang]), this.loadLocale(dictLang)]);
    } catch (e) {
      console.error('[i18n] could not load the dictionary', e);
      if (dictLang === 'fr') { // degrade to English rather than showing keys
        try { core = await this.retry(CORE.en); await this.loadLocale('en'); loaded = 'en'; } catch { /* keys will show */ }
      }
    }
    this.setScope('core', loaded, core, lang);
    this.current = lang;
    this.rebuild();
    this.applyHtmlLang();
  }

  /** Registers a lazy module's dictionaries (both languages). */
  register(scope: Exclude<Scope, 'core'>, dicts: { en: Dict; fr: Dict }): void {
    this.scopes[scope] = { fr: dicts.fr, en: dicts.en, pseudo: this.current === 'pseudo' ? this.mapPseudo(dicts.en) : undefined };
    this.rebuild();
  }

  /** Test helper: installs complete dictionaries synchronously. */
  preload(lang: AnyLang, dicts: { core: { en: Dict; fr: Dict }; patientFile: { en: Dict; fr: Dict }; pages: { en: Dict; fr: Dict } }): void {
    this.current = lang;
    for (const scope of ['core', 'patientFile', 'pages'] as const) {
      this.scopes[scope] = { fr: dicts[scope].fr, en: dicts[scope].en, pseudo: this.mapPseudo(dicts[scope].en) };
    }
    this.rebuild();
    this.applyHtmlLang();
  }

  /** Test helper: adds or overrides entries for one language. */
  extend(lang: AnyLang, entries: Dict): void {
    const target = (this.scopes['core'] ??= {});
    target[lang] = { ...(target[lang] ?? {}), ...entries };
    this.rebuild();
  }

  t(key: TKey | Msg | string, params?: Params): string {
    if (typeof key === 'object') {
      return this.t(key.key, key.params);
    }
    let entry = this.merged.get(key) ?? this.fallback.get(key);
    if (entry === undefined) {
      this.onMissing(key);
      return key;
    }
    if (typeof entry !== 'string') {
      entry = this.plural(entry, params?.['count']);
    }
    return this.interpolate(key, entry, params);
  }

  has(key: string): boolean {
    return this.merged.has(key) || this.fallback.has(key);
  }

  hint(): Lang | null {
    return this.readHint()?.lang ?? null;
  }

  readHint(): LangHint | null {
    try {
      const raw = localStorage.getItem(HINT_KEY);
      if (!raw) {
        return null;
      }
      if (isLang(raw)) {
        return { lang: raw, explicit: false };
      }
      const parsed = JSON.parse(raw) as Partial<LangHint>;
      return isLang(parsed?.lang) ? { lang: parsed.lang, explicit: parsed.explicit === true } : null;
    } catch {
      return null;
    }
  }

  setHint(lang: Lang, explicit: boolean): void {
    try {
      localStorage.setItem(HINT_KEY, JSON.stringify({ lang, explicit }));
    } catch { /* storage may be blocked */ }
  }

  /** A text was asked for that no dictionary has. Tests override this to fail loudly. */
  protected onMissing(key: string): void {
    console.error('[i18n] missing', key);
  }

  private plural(entry: PluralEntry, count: string | number | undefined): string {
    const n = typeof count === 'number' ? count : Number(count);
    if (count === undefined || Number.isNaN(n)) {
      console.error('[i18n] plural entry needs a numeric count');
      return entry.other;
    }
    if (n === 0 && entry.zero !== undefined) {
      return entry.zero;
    }
    const locale = this.locale;
    let rules = this.rules.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(locale);
      this.rules.set(locale, rules);
    }
    return rules.select(n) === 'one' ? entry.one : entry.other;
  }

  private interpolate(key: string, text: string, params?: Params): string {
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const v = params?.[name];
      if (v === undefined) {
        console.error('[i18n] missing placeholder', name, 'in', key);
        return whole;
      }
      return typeof v === 'number' ? formatNumber(v, this.locale, '1.0-2') : v;
    });
  }

  private setScope(scope: Scope, dictLang: Lang, core: Dict | undefined, lang: AnyLang): void {
    const entry: Partial<Record<AnyLang, Dict>> = {};
    if (core) {
      entry[dictLang] = core;
      if (lang === 'pseudo') {
        entry.pseudo = this.mapPseudo(core);
      }
    }
    this.scopes[scope] = entry;
    // Re-derive pseudo for scopes that were registered before the switch
    if (lang === 'pseudo') {
      for (const s of ['patientFile', 'pages'] as const) {
        const d = this.scopes[s];
        if (d?.en) {
          d.pseudo = this.mapPseudo(d.en);
        }
      }
    }
  }

  private mapPseudo(en: Dict): Dict {
    const out: Dict = {};
    for (const [k, v] of Object.entries(en)) {
      out[k] = typeof v === 'string' ? pseudo(v) : { ...(v.zero !== undefined ? { zero: pseudo(v.zero) } : {}), one: pseudo(v.one), other: pseudo(v.other) };
    }
    return out;
  }

  private rebuild(): void {
    this.merged = new Map();
    this.fallback = new Map();
    for (const scope of Object.values(this.scopes)) {
      for (const [k, v] of Object.entries(scope?.[this.current] ?? {})) {
        this.merged.set(k, v);
      }
      for (const [k, v] of Object.entries(scope?.en ?? {})) {
        this.fallback.set(k, v);
      }
    }
  }

  private applyHtmlLang(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = HTML_LANG[this.current];
    }
  }

  private async loadLocale(lang: Lang): Promise<void> {
    const data = await this.retry(LOCALE_DATA[lang]);
    registerLocaleData(data, LOCALE[lang]);
  }

  private async retry<T>(load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } catch {
      return load();
    }
  }
}
