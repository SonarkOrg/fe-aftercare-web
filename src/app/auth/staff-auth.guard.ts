import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { map, take } from 'rxjs';
import { StaffAuth } from './staff-auth';

export const staffAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(StaffAuth);
  return auth.isAuthenticated$.pipe(
    take(1),
    map(ok => {
      if (ok) {
        return true;
      }
      auth.login(state.url);
      return false;
    })
  );
};
