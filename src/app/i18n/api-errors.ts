// i18n-ignore-file: the server's fixed English messages, matched verbatim to pick a translation
import { Injectable } from '@angular/core';
import { apiErrorOf } from '../models/api-error.model';
import { I18nService } from './i18n.service';
import { Params, TKey } from './i18n.types';

/** error.code.<CODE> for every code the backend can send. */
export const ERROR_CODE_KEYS: Record<string, TKey> = {
  NOT_FOUND: 'error.code.NOT_FOUND',
  VALIDATION_FAILED: 'error.code.VALIDATION_FAILED',
  CONFLICT: 'error.code.CONFLICT',
  INVALID_STATE: 'error.code.INVALID_STATE',
  PAYLOAD_TOO_LARGE: 'error.code.PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'error.code.UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'error.code.RATE_LIMITED',
  ALREADY_SUBMITTED: 'error.code.ALREADY_SUBMITTED',
  STAFF_INACTIVE: 'error.code.STAFF_INACTIVE',
  NOT_AUTHOR: 'error.code.NOT_AUTHOR',
  PATIENT_HAS_RECORDS: 'error.code.PATIENT_HAS_RECORDS',
  NO_ACTIVE_QUESTIONNAIRE: 'error.code.NO_ACTIVE_QUESTIONNAIRE',
  MESSAGING_CLOSED: 'error.code.MESSAGING_CLOSED',
  FOLLOW_UP_ALREADY_ACTIVE: 'error.code.FOLLOW_UP_ALREADY_ACTIVE',
  EDIT_WINDOW_CLOSED: 'error.code.EDIT_WINDOW_CLOSED',
  DUPLICATE_STAFF: 'error.code.DUPLICATE_STAFF',
  ALREADY_ASSIGNED: 'error.code.ALREADY_ASSIGNED',
  NOT_STAFF: 'error.code.NOT_STAFF',
  FORBIDDEN: 'error.code.FORBIDDEN',
  LAST_ADMIN: 'error.code.LAST_ADMIN',
  NO_CONSENT: 'error.code.NO_CONSENT',
  CHANNEL_DISABLED: 'error.code.CHANNEL_DISABLED',
  NO_RECIPIENT: 'error.code.NO_RECIPIENT',
  LINK_UNAVAILABLE: 'error.code.LINK_UNAVAILABLE',
  NOTIFICATION_LIMIT: 'error.code.NOTIFICATION_LIMIT'
};

// Must match the backend's fixed messages; when the BE adds one, add it here (unknown ones fall back to the code key).
export const API_MESSAGE_KEYS: Record<string, TKey> = {
  'NOT_FOUND|Staff member not found': 'error.msg.staffNotFound',
  'NOT_FOUND|Follow-up not found': 'error.msg.followUpNotFound',
  'NOT_FOUND|Appointment not found': 'error.msg.appointmentNotFound',
  'NOT_FOUND|Questionnaire not found': 'error.msg.questionnaireNotFound',
  'NOT_FOUND|No health number on file': 'error.msg.noHealthNumber',
  'NOT_FOUND|Alert not found': 'error.msg.alertNotFound',
  'CONFLICT|The record was modified concurrently; retry': 'error.msg.concurrent',
  'PATIENT_HAS_RECORDS|Patient has follow-ups or appointments and cannot be deleted': 'error.msg.hasFollowUps',
  'PATIENT_HAS_RECORDS|Patient has records (notes, documents, messages, medical items, contacts or care team) and cannot be deleted': 'error.msg.hasRecords',
  'NO_ACTIVE_QUESTIONNAIRE|No active questionnaire for this specialty': 'error.msg.noQSpecialty',
  'NO_ACTIVE_QUESTIONNAIRE|No active questionnaire for this appointment type': 'error.msg.noQType',
  'RATE_LIMITED|Too many messages; try again later': 'error.msg.tooManyMessages',
  'INVALID_STATE|Type cannot change after the questionnaire was submitted': 'error.msg.typeLocked',
  'INVALID_STATE|Staff member is already inactive': 'error.msg.staffAlreadyInactive',
  'INVALID_STATE|Staff member is already active': 'error.msg.staffAlreadyActive',
  'INVALID_STATE|Note was entered in error': 'error.msg.noteInError',
  'INVALID_STATE|Note was already entered in error': 'error.msg.noteAlreadyInError',
  'INVALID_STATE|Follow-up is not active': 'error.msg.followUpNotActive',
  'INVALID_STATE|Follow-up is already closed': 'error.msg.followUpClosed',
  'INVALID_STATE|Appointment status can no longer be changed': 'error.msg.apptStatusLocked',
  'INVALID_STATE|Appointment does not need review': 'error.msg.apptNoReview',
  'INVALID_STATE|Appointment cannot be deleted': 'error.msg.apptNoDelete',
  'INVALID_STATE|Appointment can no longer be changed': 'error.msg.apptLocked',
  'INVALID_STATE|Appointment can no longer accept a questionnaire': 'error.msg.apptNoQuestionnaire',
  'INVALID_STATE|Alert is not open': 'error.msg.alertNotOpen',
  'INVALID_STATE|Alert is already resolved': 'error.msg.alertResolved',
  'INVALID_STATE|Access link cannot be regenerated': 'error.msg.linkNoRegen',
  'INVALID_STATE|Appointment link is not usable': 'error.msg.apptLinkUnusable',
  'INVALID_STATE|A retention run is already in progress': 'error.msg.retentionRunning'
};

/** Exact `field|message` pairs. */
export const FIELD_MESSAGE_KEYS: Record<string, TKey> = {
  'to|must not be before from': 'error.field.toBeforeFrom',
  'scheduledAt|must be in the future': 'error.field.future',
  'scheduledAt|does not exist in the America/Toronto time zone (daylight saving gap)': 'error.field.dstGap',
  'notedAt|must be within the last 7 days': 'error.field.notedAtRange',
  'healthNumber|must be a valid RAMQ number (4 letters, 8 digits)': 'error.field.healthNumber',
  'dateOfBirth|must be in the past': 'error.field.past',
  'dateOfBirth|must not be before 1900-01-01': 'error.field.dobMin',
  'file|must not be empty': 'error.field.fileEmpty',
  'checkInReminderTime|must be before the missed check-in cutoff': 'error.field.reminderBeforeCutoff',
  'contactConsent|cannot be reset to UNKNOWN': 'error.field.consentNoReset',
  'status|must be CANCELLED, COMPLETED or NO_SHOW': 'error.field.invalid',
  'resourceType|must be QuestionnaireResponse': 'error.field.invalid'
};

interface FieldPattern { re: RegExp; key: TKey; params: (m: RegExpExecArray) => Params }

const FIELD_PATTERNS: FieldPattern[] = [
  { re: /^range must not exceed (\d+) days$/, key: 'error.field.rangeMax', params: m => ({ days: Number(m[1]) }) },
  { re: /^(must not be (blank|null|empty)|required)$/, key: 'error.field.required', params: () => ({}) },
  { re: /^size must be between (\d+) and (\d+)$/, key: 'error.field.maxLength', params: m => ({ max: Number(m[2]) }) },
  { re: /^must be at most (\d+) characters$/, key: 'error.field.maxLength', params: m => ({ max: Number(m[1]) }) },
  { re: /^must be between (\d+) and (\d+) characters$/, key: 'error.field.lengthRange', params: m => ({ min: Number(m[1]), max: Number(m[2]) }) },
  { re: /^must be a valid phone number$/, key: 'error.field.phone', params: () => ({}) },
  { re: /^must be a valid postal code$/, key: 'error.field.postal', params: () => ({}) },
  { re: /^must be a valid ICD-10 code$/, key: 'error.field.icd10', params: () => ({}) },
  { re: /^must be a time as HH:mm$/, key: 'error.field.time', params: () => ({}) },
  { re: /^must be a two-letter uppercase code$/, key: 'error.field.province', params: () => ({}) },
  { re: /^must not be in the future$/, key: 'error.field.notFuture', params: () => ({}) },
  { re: /^must be within the last 30 days$/, key: 'error.field.last30', params: () => ({}) },
  { re: /^must be between 1900-01-01 and one year from today$/, key: 'error.field.dateRange', params: () => ({}) },
  { re: /^must not be blank and at most (\d+) characters$/, key: 'error.field.requiredMax', params: m => ({ max: Number(m[1]) }) },
  { re: /^must be (a number|an integer)$/, key: 'error.field.number', params: () => ({}) },
  { re: /^must not contain whitespace$/, key: 'error.field.noSpaces', params: () => ({}) },
  { re: /^must be between (\d+) and (\d+)$/, key: 'error.field.between', params: m => ({ min: Number(m[1]), max: Number(m[2]) }) },
  { re: /^must be at least (\d+) months$/, key: 'error.field.monthsMin', params: m => ({ min: Number(m[1]) }) },
  { re: /^must be between (\d+) and (\d+) months$/, key: 'error.field.monthsRange', params: m => ({ min: Number(m[1]), max: Number(m[2]) }) },
  { re: /^must be a well-formed email address$/, key: 'error.field.email', params: () => ({}) },
  { re: /^must be greater than or equal to (\d+)$/, key: 'error.field.min', params: m => ({ min: Number(m[1]) }) },
  { re: /^must be at least (\d+)$/, key: 'error.field.min', params: m => ({ min: Number(m[1]) }) },
  { re: /^must be less than or equal to (\d+)$/, key: 'error.field.max', params: m => ({ max: Number(m[1]) }) }
];

/** Translates API errors by their code. The server's own message text is never shown. */
@Injectable({ providedIn: 'root' })
export class ApiErrorsService {
  constructor(private i18n: I18nService) {}

  text(err: unknown, fallback: TKey, ctx?: Partial<Record<string, TKey>>): string {
    const api = apiErrorOf(err);
    const httpStatus = (err as { status?: number } | null)?.status;
    // A 5xx is a server fault whatever the body says: never show a code-specific message for it.
    if (typeof httpStatus === 'number' && httpStatus >= 500 || (api && api.status >= 500)) {
      return this.i18n.t('error.server');
    }
    if (!api) {
      const status = httpStatus;
      if (status === 0) {
        return this.i18n.t('error.network');
      }
      if (status === 401) {
        return this.i18n.t('error.session');
      }
      return this.i18n.t(fallback);
    }
    const override = ctx?.[api.error];
    if (override) {
      return this.i18n.t(override);
    }
    const byMessage = API_MESSAGE_KEYS[`${api.error}|${api.message}`];
    if (byMessage) {
      return this.i18n.t(byMessage);
    }
    const byCode = ERROR_CODE_KEYS[api.error];
    if (byCode) {
      return this.i18n.t(byCode);
    }
    return this.i18n.t('error.withCode', { text: this.i18n.t(fallback), code: api.error });
  }

  /** A field-level validation message from `fieldErrors`. */
  fieldText(field: string, serverMessage: string): string {
    const exact = FIELD_MESSAGE_KEYS[`${field}|${serverMessage}`];
    if (exact) {
      return this.i18n.t(exact);
    }
    for (const p of FIELD_PATTERNS) {
      const m = p.re.exec(serverMessage);
      if (m) {
        return this.i18n.t(p.key, p.params(m));
      }
    }
    return this.i18n.t('error.field.invalid');
  }

  /** The inline messages for every field of a VALIDATION_FAILED response. */
  fieldTexts(err: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [field, msg] of Object.entries(apiErrorOf(err)?.fieldErrors ?? {})) {
      out[field] = this.fieldText(field, msg);
    }
    return out;
  }
}
