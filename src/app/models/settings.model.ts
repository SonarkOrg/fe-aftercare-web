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
}

export interface ClinicSettings extends ClinicSettingsRequest {
  updatedAt: string | null;
  updatedByName: string | null;
}
