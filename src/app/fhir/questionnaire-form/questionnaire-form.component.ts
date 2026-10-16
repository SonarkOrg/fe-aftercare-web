import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  FhirItem, FhirQuestionnaire, FhirQuestionnaireResponse
} from '../fhir.model';
import {
  AnswerMap, AnswerValue, Lang, answerOf, answersFromResponse, buildResponse, displayAnswer, helpTexts, isEnabled,
  localize, maxOf, minOf, unitOf, validateAnswer
} from '../fhir.util';

export const WORDS: Record<Lang, Record<string, string>> = {
  fr: { yes: 'Oui', no: 'Non', optional: '(facultatif)', invalidNumber: 'Valeur invalide', tooLong: 'Texte trop long', notAnswered: '—' },
  en: { yes: 'Yes', no: 'No', optional: '(optional)', invalidNumber: 'Invalid value', tooLong: 'Text too long', notAnswered: '—' }
};

type RawValue = boolean | number | string | undefined;
type Kind = 'display' | 'boolean' | 'grid' | 'number' | 'string' | 'text' | 'choice';

interface ReadonlyRow {
  label: string;
  text: string;
  answered: boolean;
}

/** Generic renderer for the supported FHIR Questionnaire subset (edit and read-only). */
@Component({
  selector: 'app-questionnaire-form',
  templateUrl: './questionnaire-form.component.html'
})
export class QuestionnaireFormComponent implements OnChanges {
  @Input() questionnaire!: FhirQuestionnaire;
  @Input() lang: Lang = 'fr';
  @Input() mode: 'edit' | 'readonly' = 'edit';
  @Input() response: FhirQuestionnaireResponse | null = null;
  @Output() responseChange = new EventEmitter<FhirQuestionnaireResponse | null>();

  raw: Record<string, RawValue> = {};
  errors: Record<string, string | undefined> = {};
  visible: FhirItem[] = [];
  rows: ReadonlyRow[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.questionnaire) {
      return;
    }
    if (changes['questionnaire'] || changes['mode']) {
      this.raw = {};
    }
    if (this.mode === 'readonly') {
      this.buildRows();
      return;
    }
    const result = this.recompute();
    if ((changes['questionnaire'] || changes['mode']) && result) {
      this.responseChange.emit(result);
    }
  }

  w(key: string): string {
    return WORDS[this.lang][key];
  }

  txt(item: FhirItem): string {
    return localize(item.text, item._text, this.lang);
  }

  helps(item: FhirItem): string[] {
    return helpTexts(item, this.lang);
  }

  optionLabel(opt: { valueCoding: { display?: string; _display?: any } }): string {
    return localize(opt.valueCoding.display, opt.valueCoding._display, this.lang);
  }

  unit(item: FhirItem): string | null {
    return unitOf(item, this.lang);
  }

  kind(item: FhirItem): Kind {
    switch (item.type) {
      case 'integer': {
        const min = minOf(item);
        const max = maxOf(item);
        return min !== undefined && max !== undefined && max - min <= 10 ? 'grid' : 'number';
      }
      case 'decimal':
        return 'number';
      default:
        return item.type;
    }
  }

  range(item: FhirItem): number[] {
    const min = minOf(item) ?? 0;
    const max = maxOf(item) ?? 0;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  str(item: FhirItem): string {
    const v = this.raw[item.linkId];
    return v === undefined ? '' : String(v);
  }

  trackId(_i: number, item: FhirItem): string {
    return item.linkId;
  }

  set(item: FhirItem, value: RawValue): void {
    this.raw[item.linkId] = value;
    this.emit();
  }

  setText(item: FhirItem, value: string): void {
    this.raw[item.linkId] = value;
    this.emit();
  }

  private emit(): void {
    this.responseChange.emit(this.recompute());
  }

  /** Recomputes visibility/validation; returns the response when valid, otherwise null. */
  private recompute(): FhirQuestionnaireResponse | null {
    const answers: AnswerMap = {};
    const errors: Record<string, string | undefined> = {};
    const visible: FhirItem[] = [];
    let valid = true;
    for (const item of this.questionnaire.item) {
      if (!isEnabled(item, answers)) {
        delete this.raw[item.linkId];
        continue;
      }
      visible.push(item);
      if (item.type === 'display') {
        continue;
      }
      const r = validateAnswer(item, this.raw[item.linkId]);
      if (r.error) {
        valid = false;
        if (r.error === 'length') {
          errors[item.linkId] = this.w('tooLong');
        } else if (r.error !== 'required') {
          errors[item.linkId] = this.w('invalidNumber');
        }
      } else if (r.value !== undefined) {
        answers[item.linkId] = r.value;
      }
    }
    this.errors = errors;
    this.visible = visible;
    return valid ? buildResponse(this.questionnaire, answers) : null;
  }

  private buildRows(): void {
    const answers = answersFromResponse(this.questionnaire, this.response);
    this.rows = this.questionnaire.item
      .filter(i => i.type !== 'display' && isEnabled(i, answers))
      .map(i => {
        const a: AnswerValue | undefined = answerOf(this.response, i.linkId);
        return {
          label: this.txt(i),
          text: a === undefined ? '' : displayAnswer(i, a, this.lang),
          answered: a !== undefined
        };
      });
  }
}
