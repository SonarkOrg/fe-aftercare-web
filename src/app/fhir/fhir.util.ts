import {
  FhirAnswer, FhirCoding, FhirElement, FhirItem, FhirQuestionnaire, FhirQuestionnaireResponse, FhirResponseItem
} from './fhir.model';

export type Lang = 'fr' | 'en';

export const TRANSLATION = 'http://hl7.org/fhir/StructureDefinition/translation';
const EXT_MIN = 'http://hl7.org/fhir/StructureDefinition/minValue';
const EXT_MAX = 'http://hl7.org/fhir/StructureDefinition/maxValue';
const EXT_DECIMALS = 'http://hl7.org/fhir/StructureDefinition/maxDecimalPlaces';
const EXT_UNIT = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit';

/** FR is the base string; EN comes from the translation extension (falls back to the base string). */
export function localize(base: string | undefined, underscore: FhirElement | undefined, lang: Lang): string {
  if (lang === 'fr') {
    return base ?? '';
  }
  for (const ext of underscore?.extension ?? []) {
    if (ext.url !== TRANSLATION) {
      continue;
    }
    const parts = ext.extension ?? [];
    if (parts.some(p => p.url === 'lang' && p.valueCode === 'en')) {
      const content = parts.find(p => p.url === 'content')?.valueString;
      if (content !== undefined) {
        return content;
      }
    }
  }
  return base ?? '';
}

export function extValue(item: FhirItem, url: string): any {
  const ext = (item.extension ?? []).find(e => e.url === url);
  if (!ext) {
    return undefined;
  }
  return ext.valueInteger ?? ext.valueDecimal ?? ext.valueCoding;
}

export function minOf(item: FhirItem): number | undefined {
  return extValue(item, EXT_MIN);
}

export function maxOf(item: FhirItem): number | undefined {
  return extValue(item, EXT_MAX);
}

export function maxDecimalsOf(item: FhirItem): number {
  if (item.type === 'integer') {
    return 0;
  }
  return extValue(item, EXT_DECIMALS) ?? 2;
}

export function unitOf(item: FhirItem, _lang: Lang): string | null {
  const coding = extValue(item, EXT_UNIT) as FhirCoding | undefined;
  return coding?.display ?? null;
}

export function helpTexts(item: FhirItem, lang: Lang): string[] {
  return (item.item ?? []).filter(c => c.type === 'display').map(c => localize(c.text, c._text, lang));
}

export type AnswerMap = Record<string, boolean | number | string | undefined>;

/** An item is enabled when it has no enableWhen, or its source answer equals the condition. */
export function isEnabled(item: FhirItem, answers: AnswerMap): boolean {
  const cond = item.enableWhen?.[0];
  if (!cond) {
    return true;
  }
  const source = answers[cond.question];
  if (source === undefined) {
    return false;
  }
  if (cond.answerBoolean !== undefined) {
    return source === cond.answerBoolean;
  }
  if (cond.answerCoding) {
    return source === cond.answerCoding.code;
  }
  return false;
}

export type AnswerError = 'required' | 'range' | 'decimals' | 'length' | 'type';

export interface ValidatedAnswer {
  value?: boolean | number | string;
  error?: AnswerError;
}

function isEmpty(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
}

/** Parses a user-typed number ("38,2" -> 38.2). Returns NaN when it is not a finite number. */
export function parseNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw !== 'string') {
    return NaN;
  }
  const s = raw.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function validateAnswer(item: FhirItem, raw: unknown): ValidatedAnswer {
  if (isEmpty(raw)) {
    return item.required ? { error: 'required' } : {};
  }
  switch (item.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? { value: raw } : { error: 'type' };
    case 'integer':
    case 'decimal': {
      const n = parseNumber(raw);
      if (!Number.isFinite(n) || (item.type === 'integer' && !Number.isInteger(n))) {
        return { error: 'type' };
      }
      const min = minOf(item);
      const max = maxOf(item);
      if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
        return { error: 'range' };
      }
      if (item.type === 'decimal') {
        const scale = Math.pow(10, maxDecimalsOf(item));
        if (Math.abs(n * scale - Math.round(n * scale)) > 1e-7) {
          return { error: 'decimals' };
        }
      }
      return { value: n };
    }
    case 'string':
    case 'text': {
      if (typeof raw !== 'string') {
        return { error: 'type' };
      }
      const t = raw.trim();
      if (item.maxLength !== undefined && t.length > item.maxLength) {
        return { error: 'length' };
      }
      return { value: t };
    }
    case 'choice': {
      const ok = typeof raw === 'string' && (item.answerOption ?? []).some(o => o.valueCoding.code === raw);
      return ok ? { value: raw as string } : { error: 'type' };
    }
    default:
      return {};
  }
}

/** Builds the QuestionnaireResponse to POST: questionnaire order, enabled, non-empty answers only. */
export function buildResponse(q: FhirQuestionnaire, answers: AnswerMap): FhirQuestionnaireResponse {
  const items: FhirResponseItem[] = [];
  for (const item of q.item) {
    if (item.type === 'display' || !isEnabled(item, answers)) {
      continue;
    }
    const v = answers[item.linkId];
    if (v === undefined || (typeof v === 'string' && v.trim() === '')) {
      continue;
    }
    let answer: FhirAnswer | null = null;
    switch (item.type) {
      case 'boolean':
        answer = { valueBoolean: v as boolean };
        break;
      case 'integer':
        answer = { valueInteger: v as number };
        break;
      case 'decimal':
        answer = { valueDecimal: v as number };
        break;
      case 'string':
      case 'text':
        answer = { valueString: (v as string).trim() };
        break;
      case 'choice': {
        const opt = (item.answerOption ?? []).find(o => o.valueCoding.code === v);
        if (opt) {
          answer = { valueCoding: { system: opt.valueCoding.system, code: opt.valueCoding.code as string } };
        }
        break;
      }
    }
    if (answer) {
      items.push({ linkId: item.linkId, answer: [answer] });
    }
  }
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: q.url + '|' + q.version,
    status: 'completed',
    item: items
  };
}

export type AnswerValue = boolean | number | string | { system?: string; code: string; display?: string };

export function answerOf(response: FhirQuestionnaireResponse | null | undefined, linkId: string): AnswerValue | undefined {
  const a = response?.item?.find(i => i.linkId === linkId)?.answer?.[0];
  if (!a) {
    return undefined;
  }
  return a.valueBoolean ?? a.valueInteger ?? a.valueDecimal ?? a.valueString ?? a.valueCoding;
}

/** Turns a stored response into an AnswerMap (coding -> code) so isEnabled can be reused. */
export function answersFromResponse(q: FhirQuestionnaire, response: FhirQuestionnaireResponse | null | undefined): AnswerMap {
  const map: AnswerMap = {};
  for (const item of q.item) {
    const a = answerOf(response, item.linkId);
    map[item.linkId] = a !== null && typeof a === 'object' ? a.code : a;
  }
  return map;
}

export function displayAnswer(item: FhirItem, answer: AnswerValue | undefined, lang: Lang): string {
  if (answer === undefined) {
    return '';
  }
  if (typeof answer === 'boolean') {
    return lang === 'fr' ? (answer ? 'Oui' : 'Non') : (answer ? 'Yes' : 'No');
  }
  if (typeof answer === 'number') {
    const unit = unitOf(item, lang);
    return unit ? `${answer} ${unit}` : String(answer);
  }
  if (typeof answer === 'string') {
    // a bare string is either free text or a choice code
    const opt = (item.answerOption ?? []).find(o => o.valueCoding.code === answer);
    return opt ? localize(opt.valueCoding.display, opt.valueCoding._display, lang) : answer;
  }
  const opt = (item.answerOption ?? []).find(o => o.valueCoding.code === answer.code);
  if (opt) {
    return localize(opt.valueCoding.display, opt.valueCoding._display, lang);
  }
  return answer.display ?? answer.code;
}
