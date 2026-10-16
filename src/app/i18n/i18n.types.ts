import type { CoreKey } from './dict/core.en';
import type { PagesKey } from './dict/pages.en';
import type { PatientFileKey } from './dict/patient-file.en';

/** UI language. 'pseudo' only exists in dev and tests (see pseudo.ts). */
export type Lang = 'fr' | 'en';
export type AnyLang = Lang | 'pseudo';
export const LOCALE: Record<AnyLang, string> = { fr: 'fr-CA', en: 'en-CA', pseudo: 'en-CA' };
export const HTML_LANG: Record<AnyLang, string> = { fr: 'fr-CA', en: 'en-CA', pseudo: 'en-CA' };

export interface PluralEntry { zero?: string; one: string; other: string }
export type Entry = string | PluralEntry;
export type DictOf<T> = { [K in keyof T]: T[K] extends string ? string : PluralEntry };
export type Params = Record<string, string | number>;

export type TKey = CoreKey | PatientFileKey | PagesKey;

/** A text decided in TS and stored in component state: translate it in the template with `| t`. */
export interface Msg { key: TKey; params?: Params }

export type Scope = 'core' | 'patientFile' | 'pages';
export type Dict = Record<string, Entry>;
