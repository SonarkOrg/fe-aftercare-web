import { AlertSeverity } from './alert.model';

export type Language = 'FR' | 'EN';

export interface ClinicSettingsRequest {
  name: string;
  addressLine: string | null;
  city: string | null;
  province: string;
  postalCode: string | null;
  phone: string | null;
  defaultLanguage: Language;
  notifySeverities: AlertSeverity[];
  /** PRIV-A-17: null or absent = unchanged. */
  collectGender?: boolean | null;
  collectAddress?: boolean | null;
}

export interface ClinicSettings extends ClinicSettingsRequest {
  /** PRIV-A-17: gender and address are collected only when the clinic switched them on. */
  collectGender: boolean;
  collectAddress: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}
