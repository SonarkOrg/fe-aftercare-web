import { AccessRole } from './me.model';

export type StaffRole = 'NURSE' | 'NURSE_PRACTITIONER' | 'PHYSICIAN' | 'SURGEON' | 'ANESTHESIOLOGIST'
  | 'PHYSIOTHERAPIST' | 'PHARMACIST' | 'ADMINISTRATIVE' | 'OTHER';

export const STAFF_ROLES: StaffRole[] = ['NURSE', 'NURSE_PRACTITIONER', 'PHYSICIAN', 'SURGEON', 'ANESTHESIOLOGIST',
  'PHYSIOTHERAPIST', 'PHARMACIST', 'ADMINISTRATIVE', 'OTHER'];

export interface StaffRequest {
  displayName: string;
  email: string | null;
  role: StaffRole;
  accessRole: AccessRole;
  auth0Subject: string | null;
}

export interface Staff {
  id: number;
  displayName: string;
  email: string | null;
  role: StaffRole;
  accessRole: AccessRole;
  auth0Subject: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
