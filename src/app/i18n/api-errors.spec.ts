import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { I18nTestingModule } from '../testing/i18n-testing.module';
import { API_MESSAGE_KEYS, ApiErrorsService, ERROR_CODE_KEYS, FIELD_MESSAGE_KEYS } from './api-errors';

const body = (error: string, message = 'x', fieldErrors: Record<string, string> = {}, status = 400) => ({ status, error: { status, error, message, fieldErrors } });

describe('ApiErrorsService', () => {
  for (const lang of ['en', 'fr'] as const) {
    describe(lang, () => {
      let errors: ApiErrorsService;
      let i18n: I18nService;
      beforeEach(() => {
        TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang(lang)] });
        errors = TestBed.inject(ApiErrorsService);
        i18n = TestBed.inject(I18nService);
      });

      it('resolves every error code', () => {
        for (const [code, key] of Object.entries(ERROR_CODE_KEYS)) {
          expect(errors.text(body(code), 'common.cancel')).withContext(code).toBe(i18n.t(key));
        }
      });

      it('resolves every fixed backend message, and never returns the server text', () => {
        for (const [pair, key] of Object.entries(API_MESSAGE_KEYS)) {
          const [code, message] = pair.split('|');
          const out = errors.text(body(code, message), 'common.cancel');
          expect(out).withContext(pair).toBe(i18n.t(key));
          if (lang === 'fr') {
            expect(out).not.toBe(message);
          }
        }
      });

      it('A-45: SECOND_PERSON_REQUIRED is shown by its code, whatever the server message', () => {
        const e = { status: 409, error: { status: 409, error: 'SECOND_PERSON_REQUIRED', message: 'Another staff member must record this consent after a contact change', fieldErrors: {} } };
        expect(errors.text(e, 'common.cancel')).toBe(i18n.t('error.code.SECOND_PERSON_REQUIRED'));
        expect(i18n.t('error.code.SECOND_PERSON_REQUIRED')).toContain(lang === 'fr' ? 'Un autre membre du personnel' : 'Another staff member');
      });

      it('the call-site override wins over the table', () => {
        expect(errors.text(body('INVALID_STATE', 'Alert is already resolved'), 'common.cancel', { INVALID_STATE: 'alerts.error.alreadyResolved' }))
          .toBe(i18n.t('alerts.error.alreadyResolved'));
      });

      it('an unknown code uses the fallback and shows the code', () => {
        expect(errors.text(body('BRAND_NEW'), 'common.cancel')).toBe(i18n.t('error.withCode', { text: i18n.t('common.cancel'), code: 'BRAND_NEW' }));
      });

      it('network, server and session errors', () => {
        expect(errors.text({ status: 0 }, 'common.cancel')).toBe(i18n.t('error.network'));
        expect(errors.text({ status: 503 }, 'common.cancel')).toBe(i18n.t('error.server'));
        expect(errors.text({ status: 401 }, 'common.cancel')).toBe(i18n.t('error.session'));
        expect(errors.text({ status: 404 }, 'common.cancel')).toBe(i18n.t('common.cancel'));
      });

      it('a 5xx is the generic server error even when the body is an ApiError', () => {
        const e = { status: 500, error: { status: 500, error: 'CONFLICT', message: 'x', fieldErrors: {} } };
        expect(errors.text(e, 'common.cancel')).toBe(i18n.t('error.server'));
        expect(errors.text({ status: 400, error: { status: 503, error: 'CONFLICT', message: 'x', fieldErrors: {} } }, 'common.cancel')).toBe(i18n.t('error.server'));
      });

      it('INTERNAL_ERROR shows the reference when the body has one, and ends after "Try again." otherwise', () => {
        const withRef = { status: 500, error: { status: 500, error: 'INTERNAL_ERROR', message: 'Unexpected error', fieldErrors: {}, details: { reference: '1a2b3c4d' } } };
        const out = errors.text(withRef, 'common.cancel');
        expect(out).toBe(i18n.t('error.code.INTERNAL_ERROR_REF', { ref: '1a2b3c4d' }));
        expect(out).toContain('1a2b3c4d');
        expect(out).not.toBe(i18n.t('error.server'));
        const noRef = { status: 500, error: { status: 500, error: 'INTERNAL_ERROR', message: 'Unexpected error', fieldErrors: {} } };
        expect(errors.text(noRef, 'common.cancel')).toBe(i18n.t('error.code.INTERNAL_ERROR'));
        expect(errors.text(noRef, 'common.cancel')).not.toContain('{ref}');
        const odd = { status: 500, error: { status: 500, error: 'INTERNAL_ERROR', message: 'x', fieldErrors: {}, details: { reference: '<b>x</b>' } } };
        expect(errors.text(odd, 'common.cancel')).toBe(i18n.t('error.code.INTERNAL_ERROR'));
        expect(i18n.t('error.code.INTERNAL_ERROR')).toBe(lang === 'fr' ? 'Erreur inattendue. Réessayez.' : 'Unexpected error. Try again.');
      });

      it('field messages: every exact row and every pattern', () => {
        for (const [pair, key] of Object.entries(FIELD_MESSAGE_KEYS)) {
          const [field, message] = pair.split('|');
          expect(errors.fieldText(field, message)).withContext(pair).toBe(i18n.t(key));
        }
        expect(errors.fieldText('x', 'must not be blank')).toBe(i18n.t('error.field.required'));
        expect(errors.fieldText('x', 'size must be between 0 and 120')).toBe(i18n.t('error.field.maxLength', { max: 120 }));
        expect(errors.fieldText('x', 'must be between 3 and 5 characters')).toBe(i18n.t('error.field.lengthRange', { min: 3, max: 5 }));
        expect(errors.fieldText('x', 'must be between 1 and 1200 months')).toBe(i18n.t('error.field.monthsRange', { min: 1, max: 1200 }));
        expect(errors.fieldText('x', 'must be a well-formed email address')).toBe(i18n.t('error.field.email'));
        expect(errors.fieldText('x', 'must be greater than or equal to 5')).toBe(i18n.t('error.field.min', { min: 5 }));
        expect(errors.fieldText('to', 'range must not exceed 31 days')).toBe(i18n.t('error.field.rangeMax', { days: 31 }));
        expect(errors.fieldText('x', 'something nobody planned')).toBe(i18n.t('error.field.invalid'));
      });
    });
  }

  it('French results for the examples of the spec', () => {
    TestBed.configureTestingModule({ imports: [I18nTestingModule.forLang('fr')] });
    const errors = TestBed.inject(ApiErrorsService);
    expect(errors.fieldText('title', 'size must be between 0 and 120')).toBe('120 caractères au maximum.');
    expect(errors.text(body('LAST_ADMIN'), 'common.cancel')).toContain('Au moins un administrateur actif est requis.');
  });
});
