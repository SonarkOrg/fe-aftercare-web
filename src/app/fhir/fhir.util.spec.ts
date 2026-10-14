import { FhirQuestionnaireResponse } from './fhir.model';
import {
  answerOf, answersFromResponse, buildResponse, displayAnswer, extValue, helpTexts, isEnabled, localize, maxDecimalsOf,
  maxOf, minOf, unitOf, validateAnswer
} from './fhir.util';
import { FEVER, FEVER_DETAIL, FULL_Q, MOBILITY, NOTES, PAIN, STEPS, TEMP, tr } from '../testing/fixtures';
import { FhirItem } from './fhir.model';

describe('fhir.util', () => {
  describe('localize', () => {
    it('returns the base string for fr', () => {
      expect(localize('Bonjour', tr('Hello'), 'fr')).toBe('Bonjour');
    });
    it('returns the English translation for en', () => {
      expect(localize('Bonjour', tr('Hello'), 'en')).toBe('Hello');
    });
    it('falls back to the base string when there is no en translation', () => {
      expect(localize('Bonjour', undefined, 'en')).toBe('Bonjour');
      expect(localize('Bonjour', { extension: [{ url: 'http://other', valueString: 'x' }] }, 'en')).toBe('Bonjour');
      expect(localize('Bonjour', {
        extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/translation',
          extension: [{ url: 'lang', valueCode: 'de' }, { url: 'content', valueString: 'Hallo' }] }]
      }, 'en')).toBe('Bonjour');
    });
    it('returns an empty string when there is no text at all', () => {
      expect(localize(undefined, undefined, 'fr')).toBe('');
    });
  });

  describe('extension getters', () => {
    it('reads min, max, decimals and unit', () => {
      expect(minOf(PAIN)).toBe(0);
      expect(maxOf(PAIN)).toBe(10);
      expect(minOf(TEMP)).toBe(34);
      expect(maxOf(TEMP)).toBe(42);
      expect(maxDecimalsOf(TEMP)).toBe(1);
      expect(maxDecimalsOf(PAIN)).toBe(0);
      expect(unitOf(TEMP, 'fr')).toBe('°C');
      expect(unitOf(PAIN, 'en')).toBeNull();
      expect(extValue(PAIN, 'http://nope')).toBeUndefined();
    });
    it('returns 0 min (falsy) correctly', () => {
      expect(extValue(PAIN, 'http://hl7.org/fhir/StructureDefinition/minValue')).toBe(0);
    });
    it('lists nested help texts per language', () => {
      expect(helpTexts(PAIN, 'fr')).toEqual(['0 = aucune douleur']);
      expect(helpTexts(PAIN, 'en')).toEqual(['0 = no pain']);
      expect(helpTexts(FEVER, 'en')).toEqual([]);
    });
  });

  describe('isEnabled', () => {
    const coded: FhirItem = {
      linkId: 'X', type: 'string', maxLength: 5, text: 'x',
      enableWhen: [{ question: 'MOBILITY', operator: '=', answerCoding: { code: 'bedbound' } }]
    };
    it('is true without enableWhen', () => {
      expect(isEnabled(FEVER, {})).toBeTrue();
    });
    it('compares boolean sources', () => {
      expect(isEnabled(FEVER_DETAIL, { FEVER: true })).toBeTrue();
      expect(isEnabled(FEVER_DETAIL, { FEVER: false })).toBeFalse();
    });
    it('compares coding sources by code', () => {
      expect(isEnabled(coded, { MOBILITY: 'bedbound' })).toBeTrue();
      expect(isEnabled(coded, { MOBILITY: 'unaided' })).toBeFalse();
    });
    it('is false when the source is unanswered', () => {
      expect(isEnabled(FEVER_DETAIL, {})).toBeFalse();
      expect(isEnabled(coded, {})).toBeFalse();
    });
  });

  describe('validateAnswer', () => {
    it('flags required items that are empty', () => {
      expect(validateAnswer(PAIN, undefined).error).toBe('required');
      expect(validateAnswer(FEVER, '').error).toBe('required');
      expect(validateAnswer(FEVER_DETAIL, '   ').error).toBe('required');
    });
    it('accepts empty optional answers without a value', () => {
      expect(validateAnswer(TEMP, '')).toEqual({});
      expect(validateAnswer(NOTES, undefined)).toEqual({});
    });
    it('checks types', () => {
      expect(validateAnswer(FEVER, 'yes').error).toBe('type');
      expect(validateAnswer(FEVER, true).value).toBeTrue();
      expect(validateAnswer(PAIN, 'abc').error).toBe('type');
      expect(validateAnswer(PAIN, '3.5').error).toBe('type');
      expect(validateAnswer(MOBILITY, 'flying').error).toBe('type');
      expect(validateAnswer(NOTES, 5).error).toBe('type');
    });
    it('checks ranges', () => {
      expect(validateAnswer(PAIN, 11).error).toBe('range');
      expect(validateAnswer(PAIN, -1).error).toBe('range');
      expect(validateAnswer(PAIN, 10).value).toBe(10);
      expect(validateAnswer(TEMP, '33.9').error).toBe('range');
    });
    it('checks decimal places and accepts a decimal comma', () => {
      expect(validateAnswer(TEMP, '38,25').error).toBe('decimals');
      expect(validateAnswer(TEMP, '38,2').value).toBe(38.2);
      expect(validateAnswer(TEMP, 37.2).value).toBe(37.2);
      expect(validateAnswer(TEMP, 38).value).toBe(38);
    });
    it('checks text length after trimming and trims the value', () => {
      expect(validateAnswer(FEVER_DETAIL, 'x'.repeat(21)).error).toBe('length');
      expect(validateAnswer(FEVER_DETAIL, '  ' + 'x'.repeat(20) + '  ').value).toBe('x'.repeat(20));
    });
    it('accepts a valid choice code', () => {
      expect(validateAnswer(MOBILITY, 'unaided').value).toBe('unaided');
    });
  });

  describe('buildResponse', () => {
    it('builds value[x] per type in questionnaire order and omits display/disabled/empty items', () => {
      const r = buildResponse(FULL_Q, {
        MOBILITY: 'bedbound', PAIN: 4, TEMP: 38.2, STEPS: 1200, FEVER: false,
        FEVER_DETAIL: 'ignored: disabled', NOTES: '  rien  ', INTRO: 'x'
      });
      expect(r.resourceType).toBe('QuestionnaireResponse');
      expect(r.questionnaire).toBe('https://aftercare.example/fhir/Questionnaire/test|1');
      expect(r.status).toBe('completed');
      expect(r.item).toEqual([
        { linkId: 'PAIN', answer: [{ valueInteger: 4 }] },
        { linkId: 'TEMP', answer: [{ valueDecimal: 38.2 }] },
        { linkId: 'STEPS', answer: [{ valueInteger: 1200 }] },
        { linkId: 'FEVER', answer: [{ valueBoolean: false }] },
        { linkId: 'NOTES', answer: [{ valueString: 'rien' }] },
        { linkId: 'MOBILITY', answer: [{ valueCoding: { system: 'http://x/mobility', code: 'bedbound' } }] }
      ]);
    });
    it('includes an enabled dependent item and omits blank text', () => {
      const r = buildResponse(FULL_Q, { PAIN: 1, FEVER: true, FEVER_DETAIL: ' depuis hier ', NOTES: '   ', MOBILITY: 'unaided' });
      expect(r.item.map(i => i.linkId)).toEqual(['PAIN', 'FEVER', 'FEVER_DETAIL', 'MOBILITY']);
      expect(r.item[2].answer).toEqual([{ valueString: 'depuis hier' }]);
    });
  });

  describe('answerOf / displayAnswer', () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse', questionnaire: 'u|1', status: 'completed',
      item: [
        { linkId: 'PAIN', answer: [{ valueInteger: 0 }] },
        { linkId: 'TEMP', answer: [{ valueDecimal: 38.2 }] },
        { linkId: 'FEVER', answer: [{ valueBoolean: false }] },
        { linkId: 'NOTES', answer: [{ valueString: 'rien' }] },
        { linkId: 'MOBILITY', answer: [{ valueCoding: { system: 'http://x/mobility', code: 'bedbound', display: 'Alité' } }] }
      ]
    };
    it('extracts typed answers, keeping falsy ones', () => {
      expect(answerOf(response, 'PAIN')).toBe(0);
      expect(answerOf(response, 'FEVER')).toBeFalse();
      expect(answerOf(response, 'NOTES')).toBe('rien');
      expect(answerOf(response, 'STEPS')).toBeUndefined();
      expect(answerOf(null, 'PAIN')).toBeUndefined();
      expect((answerOf(response, 'MOBILITY') as any).code).toBe('bedbound');
    });
    it('builds an AnswerMap with coding codes', () => {
      const m = answersFromResponse(FULL_Q, response);
      expect(m['MOBILITY']).toBe('bedbound');
      expect(m['FEVER']).toBeFalse();
    });
    it('displays booleans in both languages', () => {
      expect(displayAnswer(FEVER, true, 'fr')).toBe('Oui');
      expect(displayAnswer(FEVER, false, 'fr')).toBe('Non');
      expect(displayAnswer(FEVER, true, 'en')).toBe('Yes');
      expect(displayAnswer(FEVER, false, 'en')).toBe('No');
    });
    it('displays numbers with their unit', () => {
      expect(displayAnswer(TEMP, 38.2, 'en')).toBe('38.2 °C');
      expect(displayAnswer(PAIN, 4, 'fr')).toBe('4');
    });
    it('displays codings as localized option text', () => {
      const a = answerOf(response, 'MOBILITY')!;
      expect(displayAnswer(MOBILITY, a, 'fr')).toBe('Alité');
      expect(displayAnswer(MOBILITY, a, 'en')).toBe('Bedbound');
      expect(displayAnswer(MOBILITY, 'unaided', 'en')).toBe('Unaided');
    });
    it('displays text as-is', () => {
      expect(displayAnswer(NOTES, 'rien', 'en')).toBe('rien');
      expect(displayAnswer(NOTES, undefined, 'en')).toBe('');
    });
  });
});
