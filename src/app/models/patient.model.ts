import { FollowUp } from './follow-up.model';

export interface Patient {
  id?: number; // Optional: not present when adding a new patient
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth?: string | null; // optional on the add form
  address: Address;
  activeFollowUp?: FollowUp | null;
  /** Null when the caller lacks CLINICAL_READ. */
  unresolvedAlertCount?: number | null;
}

export interface Address {
  city: string;
  state: string;
  zip: string;
}
