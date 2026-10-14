export interface Patient {
  id?: number; // Optional: not present when adding a new patient
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  address: Address;
}

export interface Address {
  city: string;
  state: string;
  zip: string;
}
