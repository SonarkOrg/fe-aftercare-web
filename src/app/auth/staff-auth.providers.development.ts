import { Provider } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../environments/environment';
import { Auth0StaffAuth } from './auth0-staff-auth';
import { DEV_TOKEN_URL, DevStaffAuth } from './dev-staff-auth';
import { StaffAuth } from './staff-auth';

/** Development providers: local dev token when environment.devAuth is true, otherwise Auth0. */
export const staffAuthProviders: Provider[] = environment.devAuth
  ? [
      { provide: DEV_TOKEN_URL, useValue: environment.apiUrl.replace(/\/api$/, '') + '/dev/token' },
      { provide: StaffAuth, useClass: DevStaffAuth }
    ]
  : [
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
