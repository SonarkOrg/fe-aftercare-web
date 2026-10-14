import { environment } from '../environments/environment';

// Only attach the Auth0 access token to patient API calls.
export const apiAllowedList = [
  `${environment.apiUrl}/patients`,
  `${environment.apiUrl}/patients/*`
];
