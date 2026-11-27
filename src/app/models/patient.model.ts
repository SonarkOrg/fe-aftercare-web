import { FollowUp } from './follow-up.model';
import type { ContactConsent } from './notification.model';

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
  /** Read-only (phase 1A): changed only through PUT /patients/{id}/contact-consent. */
  contactConsent?: ContactConsent;
}

export interface Address {
  city: string;
  state: string;
  zip: string;
}
