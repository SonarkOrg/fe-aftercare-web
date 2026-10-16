import { TKey } from './i18n.types';

/** Enum groups that have `enum.<group>.<VALUE>` keys. */
export type EnumGroup = 'accessRole' | 'staffRole' | 'appointmentType' | 'appointmentStatus' | 'alertSeverity' | 'alertStatus'
  | 'alertType' | 'patientStatus' | 'allergySeverity' | 'documentCategory' | 'specialty' | 'followUpDisplayStatus'
  | 'questionnairePurpose' | 'questionnaireStatus' | 'actorType' | 'timelineCategory' | 'auditAction' | 'auditResource'
  | 'notificationChannel' | 'notificationTemplate' | 'notificationStatus' | 'notificationError' | 'contactConsent'
  | 'retentionMode' | 'retentionTrigger' | 'retentionRunStatus' | 'emailProvider' | 'smsProvider' | 'language';

/** The key for an enum value. Dynamic, so the dictionary test (not the compiler) checks that every value has one. */
export function enumKey(group: EnumGroup, value: string): TKey {
  return `enum.${group}.${value}` as TKey;
}
