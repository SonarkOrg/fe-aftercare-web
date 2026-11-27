import { CORE_EN } from '../i18n/dict/core.en';
import { CORE_FR } from '../i18n/dict/core.fr';
import { AUDIT_ACTIONS } from './audit.model';

/** PRIV-A-02: every audit action the API can write has a fr-CA and an en-CA label, and the two differ. */
describe('audit actions', () => {
  const fr = CORE_FR as unknown as Record<string, string>;
  const en = CORE_EN as unknown as Record<string, string>;

  it('lists each action once', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });

  it('includes the actions of the audit coverage work', () => {
    for (const a of ['PATIENT_LIST_VIEWED', 'PATIENT_DATA_VIEWED', 'AGGREGATE_VIEWED', 'FOLLOW_UP_CREATED', 'FOLLOW_UP_CLOSED',
      'APPOINTMENT_CREATED', 'APPOINTMENT_UPDATED', 'APPOINTMENT_STATUS_CHANGED', 'APPOINTMENT_DELETED', 'ALERT_ACKNOWLEDGED',
      'ALERT_RESOLVED', 'LINK_OPENED', 'LINK_SUBMITTED', 'LINK_THREAD_VIEWED', 'LINK_LOOKUP_FAILED']) {
      expect(AUDIT_ACTIONS as string[]).toContain(a);
    }
  });

  it('has a non-empty fr and en label for every action, and they differ', () => {
    for (const a of AUDIT_ACTIONS) {
      const key = 'enum.auditAction.' + a;
      expect(fr[key]).withContext('fr ' + a).toBeTruthy();
      expect(en[key]).withContext('en ' + a).toBeTruthy();
      expect(fr[key]).withContext('differ ' + a).not.toBe(en[key]);
    }
  });
});
