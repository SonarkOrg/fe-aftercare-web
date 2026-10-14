import { Provider } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../environments/environment';
import { Auth0StaffAuth } from './auth0-staff-auth';
import { StaffAuth } from './staff-auth';

/** Production providers. Replaced by staff-auth.providers.development.ts in the development build. */
export const staffAuthProviders: Provider[] = [
  provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: environment.auth0.audience
    }
  }),
  { provide: StaffAuth, useClass: Auth0StaffAuth }
];
