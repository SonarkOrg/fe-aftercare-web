import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorOf } from '../models/api-error.model';
import { Permission } from '../models/me.model';
import { Permissions } from './permissions.service';

/** Loads /api/me once for the shell. An unlinked login goes to /not-staff; any other failure must not lock the user out. */
export const meGuard: CanActivateFn = () => {
  const permissions = inject(Permissions);
  const router = inject(Router);
  return permissions.load().pipe(
    map((): boolean | UrlTree => true),
    catchError(err => of<boolean | UrlTree>(apiErrorOf(err)?.error === 'NOT_STAFF' ? router.createUrlTree(['/not-staff']) : true))
  );
};

/** `data.permission` (one) or `data.permissionAny` (any of): otherwise /forbidden. */
export const permissionGuard: CanActivateFn = route => {
  const permissions = inject(Permissions);
  const router = inject(Router);
  const one = route.data['permission'] as Permission | undefined;
  const any = route.data['permissionAny'] as Permission[] | undefined;
  const needed: Permission[] = any ?? (one ? [one] : []);
  return permissions.load().pipe(
    map((): boolean | UrlTree => (needed.length === 0 || permissions.canAny(...needed) ? true : router.createUrlTree(['/forbidden']))),
    catchError(err => of<boolean | UrlTree>(apiErrorOf(err)?.error === 'NOT_STAFF' ? router.createUrlTree(['/not-staff']) : true))
  );
};
