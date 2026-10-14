import { FollowUp } from './follow-up.model';

export interface Patient {
  id?: number; // Optional: not present when adding a new patient
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  address: Address;
  activeFollowUp?: FollowUp | null;
  unresolvedAlertCount?: number;
}

export interface Address {
  city: string;
  state: string;
  zip: string;
}
