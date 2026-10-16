import { WORDS } from '../fhir/questionnaire-form/questionnaire-form.component';
import { QUESTIONNAIRE_TEXT } from '../components/patient-questionnaire/patient-questionnaire.i18n';
import { PATIENT_MESSAGES_TEXT } from '../components/patient-questionnaire/patient-messages/patient-messages.i18n';
import { CORE_EN } from './dict/core.en';
import { CORE_FR } from './dict/core.fr';
import { PAGES_EN } from './dict/pages.en';
import { PAGES_FR } from './dict/pages.fr';
import { PATIENT_FILE_EN } from './dict/patient-file.en';
import { PATIENT_FILE_FR } from './dict/patient-file.fr';
import { API_MESSAGE_KEYS, ERROR_CODE_KEYS, FIELD_MESSAGE_KEYS } from './api-errors';
import { ENUM_VALUES } from './enum-values';
import { Entry } from './i18n.types';

type Flat = Record<string, string>;

/** Flattens strings and plural entries to `key` / `key#form` -> text. */
function flat(dict: Record<string, Entry | string>): Flat {
  const out: Flat = {};
  for (const [k, v] of Object.entries(dict)) {
    if (typeof v === 'string') {
      out[k] = v;
    } else {
      for (const [form, text] of Object.entries(v)) {
        out[`${k}#${form}`] = text as string;
      }
    }
  }
  return out;
}

/** A /q record (per-language object of strings) as a flat key map. */
const fromRecord = (r: Record<string, string>): Flat => ({ ...r });

const PAIRS: { name: string; en: Flat; fr: Flat }[] = [
  { name: 'core', en: flat(CORE_EN as never), fr: flat(CORE_FR as never) },
  { name: 'patientFile', en: flat(PATIENT_FILE_EN as never), fr: flat(PATIENT_FILE_FR as never) },
  { name: 'pages', en: flat(PAGES_EN as never), fr: flat(PAGES_FR as never) },
  { name: '/q questionnaire', en: fromRecord(QUESTIONNAIRE_TEXT.en as never), fr: fromRecord(QUESTIONNAIRE_TEXT.fr as never) },
  { name: '/q messages', en: fromRecord(PATIENT_MESSAGES_TEXT.en as never), fr: fromRecord(PATIENT_MESSAGES_TEXT.fr as never) },
  { name: 'questionnaire form', en: WORDS.en, fr: WORDS.fr }
];

const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');

/**
 * French values that are legitimately the same as English: proper names, shared words, units and codes.
 * Each entry says why. A new identical value fails the test until someone decides it belongs here.
 */
const SAME_IN_BOTH = new Set([
  'Patients', 'Patient', 'Messages', 'Documents', 'Menu', 'Action', 'Notifications', 'Stable', 'Type', 'Version', 'Date', 'Message', 'Condition', 'Question', 'Description', 'Dose', 'Substance',
  'Langue / Language', // bilingual on purpose: the language switch label
  '{greeting}, {name}.', // punctuation only around two placeholders
  '{label}, {count}', '%', '≥{value}', '—', 'URL', 'Profession', 'SMTP', 'Twilio',
  '{count} patient', '{count} patients', 'patients', // the plural words are the same in both languages
  'Questionnaire', 'Document', 'Notification', 'Actions', 'Allergies', 'Conversations', 'Province', 'Mode', // same word in both languages
]);

describe('dictionaries', () => {
  for (const { name, en, fr } of PAIRS) {
    describe(name, () => {
      it('has identical key sets', () => {
        expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
      });

      it('has no empty values and no leading or trailing spaces', () => {
        for (const [k, v] of Object.entries({ ...en, ...fr })) {
          expect(v.trim()).withContext(k).not.toBe('');
          expect(v).withContext(`"${k}" has a leading or trailing space`).toBe(v.trim());
        }
      });

      it('has identical placeholders per key and plural form', () => {
        for (const k of Object.keys(en)) {
          expect(placeholders(fr[k] ?? '')).withContext(k).toBe(placeholders(en[k]));
        }
      });

      it('has no HTML in values', () => {
        for (const [k, v] of Object.entries({ ...en, ...fr })) {
          expect(v).withContext(k).not.toMatch(/[<>]/);
        }
      });

      it('follows French typography and uses "courriel"', () => {
        for (const [k, v] of Object.entries(fr)) {
          expect(v).withContext(`${k}: U+0020 before a colon`).not.toMatch(/ :/);
          expect(v).withContext(`${k}: space before ? ! ;`).not.toMatch(/ [?!;]/);
          expect(v).withContext(`${k}: use "courriel"`).not.toMatch(/e-?mail/i);
          // The colon needs a non-breaking space before it (clock times "14:05" and "https://" are not prose colons).
          expect(v.replace(/https?:\/\//g, '').replace(/\d:\d/g, '').replace(/HH:mm/g, '')).withContext(`${k}: colon without a non-breaking space before it`).not.toMatch(/[^\s\u00a0\u202f]:/);
          // A number or placeholder and its unit are joined by a non-breaking space.
          expect(v).withContext(`${k}: plain space between a number and its unit (h, s, min, %, °C, Mo, ko)`).not.toMatch(/[\d}] (?:h|s|min|%|°C|Mo|ko)(?![\p{L}])/u);
          expect(v).withContext(`${k}: « » need a non-breaking space inside`).not.toMatch(/«(?![\u00a0\u202f])|(?<![\u00a0\u202f])»/);
        }
      });

      if (name === 'core' || name === 'patientFile' || name === 'pages') {
        it('has the same shape (string or plural) in both languages, with {count} in one and other', () => {
          for (const k of Object.keys(en)) {
            if (k.includes('#')) {
              const [base, form] = k.split('#');
              if (form === 'one' || form === 'other') {
                expect(en[k]).withContext(k).toContain('{count}');
                expect(fr[k]).withContext(k).toContain('{count}');
              }
              expect(fr[`${base}#other`]).withContext(base).toBeDefined();
            }
          }
        });

        it('differs from English, except for the documented same-in-both values', () => {
          for (const k of Object.keys(en)) {
            if (en[k] === fr[k]) {
              expect(SAME_IN_BOTH.has(en[k])).withContext(`${k} = "${en[k]}" is the same in French: translate it or document why`).toBeTrue();
            }
          }
        });
      }
    });
  }

  it('has a key for every value of every enum', () => {
    for (const [group, values] of Object.entries(ENUM_VALUES)) {
      for (const v of values) {
        expect(`enum.${group}.${v}` in CORE_EN).withContext(`enum.${group}.${v}`).toBeTrue();
        expect(`enum.${group}.${v}` in CORE_FR).withContext(`enum.${group}.${v} (fr)`).toBeTrue();
      }
    }
  });

  it('every API error table points at an existing key', () => {
    for (const table of [ERROR_CODE_KEYS, API_MESSAGE_KEYS, FIELD_MESSAGE_KEYS]) {
      for (const [row, key] of Object.entries(table)) {
        expect(key in CORE_EN).withContext(`${row} -> ${key}`).toBeTrue();
      }
    }
  });
});
