/** TypeScript types for the FHIR R4 Questionnaire subset the API serves (spec section 5). */

export interface FhirExtension {
  url: string;
  valueCode?: string;
  valueString?: string;
  valueInteger?: number;
  valueDecimal?: number;
  valueCoding?: FhirCoding;
  extension?: FhirExtension[];
}

/** The `_text` / `_title` / `_display` companion element carrying translations. */
export interface FhirElement {
  extension?: FhirExtension[];
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
  _display?: FhirElement;
}

export interface FhirEnableWhen {
  question: string;
  operator: '=';
  answerBoolean?: boolean;
  answerCoding?: FhirCoding;
}

export interface FhirAnswerOption {
  valueCoding: FhirCoding;
}

export type FhirItemType = 'boolean' | 'integer' | 'decimal' | 'string' | 'text' | 'choice' | 'display';

export interface FhirItem {
  linkId: string;
  type: FhirItemType;
  text?: string;
  _text?: FhirElement;
  required?: boolean;
  maxLength?: number;
  code?: FhirCoding[];
  answerOption?: FhirAnswerOption[];
  extension?: FhirExtension[];
  enableWhen?: FhirEnableWhen[];
  item?: FhirItem[];
}

export interface FhirQuestionnaire {
  resourceType: 'Questionnaire';
  id?: string;
  url: string;
  version: string;
  status?: string;
  language?: string;
  title?: string;
  _title?: FhirElement;
  item: FhirItem[];
}

export interface FhirAnswer {
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueString?: string;
  valueCoding?: { system?: string; code: string; display?: string };
}

export interface FhirResponseItem {
  linkId: string;
  answer?: FhirAnswer[];
}

export interface FhirQuestionnaireResponse {
  resourceType: 'QuestionnaireResponse';
  questionnaire: string;
  status: 'completed';
  authored?: string;
  item: FhirResponseItem[];
}
