import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { MeService } from '../Services/Me.service';
import { I18nService } from '../i18n/i18n.service';
import { Lang } from '../i18n/i18n.types';
import { apiErrorOf } from '../models/api-error.model';
import { Me, Permission } from '../models/me.model';
import { Permissions } from './permissions.service';

/**
 * The language the person asked for: the saved preference, else an explicit choice made before logging in (adopted and
 * saved now), else French. Only the first /api/me of a session can change the language, and it does so before the shell renders.
 */
async function applyUiLanguage(me: Me, i18n: I18nService, meService: MeService): Promise<void> {
  const hint = i18n.readHint();
  let wanted: Lang = 'fr';
  if (me.uiLanguage) {
    wanted = me.uiLanguage === 'EN' ? 'en' : 'fr';
  } else if (hint?.explicit) {
    wanted = hint.lang;
    meService.updatePreferences(wanted).subscribe({ error: () => { /* the hint stays; we try again next session */ } });
  }
  if (i18n.lang !== 'pseudo' && wanted !== i18n.lang) {
    await i18n.use(wanted);
  }
  i18n.setHint(wanted, false);
}

/** Loads /api/me once for the shell. An unlinked login goes to /not-staff; any other failure must not lock the user out. */
export const meGuard: CanActivateFn = () => {
  const permissions = inject(Permissions);
  const router = inject(Router);
  const i18n = inject(I18nService);
  const meService = inject(MeService);
  return permissions.load().pipe(
    switchMap(me => from(applyUiLanguage(me, i18n, meService))),
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
