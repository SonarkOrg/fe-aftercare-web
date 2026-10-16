import { StaffRole } from './staff.model';

export type AccessRole = 'ADMIN' | 'PHYSICIAN' | 'NURSE' | 'RECEPTION';
export type Permission = 'PATIENT_READ' | 'PATIENT_WRITE' | 'PATIENT_DELETE'
  | 'CLINICAL_READ' | 'CLINICAL_WRITE' | 'HEALTH_NUMBER_REVEAL'
  | 'APPOINTMENT_READ' | 'APPOINTMENT_WRITE'
  | 'FORMS_READ' | 'REPORTS_READ' | 'AUDIT_READ'
  | 'STAFF_READ' | 'STAFF_MANAGE' | 'SETTINGS_READ' | 'SETTINGS_MANAGE';

export const ACCESS_ROLES: AccessRole[] = ['ADMIN', 'PHYSICIAN', 'NURSE', 'RECEPTION'];

export const ROLE_LABEL: Record<AccessRole, string> = { ADMIN: 'Admin', PHYSICIAN: 'Physician', NURSE: 'Nurse', RECEPTION: 'Reception' };

/** GET /api/me. The permission list is the only thing the UI checks (never the role). */
export interface Me {
  staffId: number;
  sub: string;
  displayName: string;
  email: string | null;
  role: StaffRole;
  accessRole: AccessRole;
  permissions: Permission[];
}
