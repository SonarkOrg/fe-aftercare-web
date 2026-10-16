import { InjectionToken, Type } from '@angular/core';

/**
 * The dev role switcher, as a component type. It is provided only by staff-auth.providers.development.ts, so the
 * production bundle contains no dev identity UI at all (the shell renders it with ngComponentOutlet when present).
 */
export const DEV_IDENTITY_UI = new InjectionToken<Type<unknown> | null>('IDENTITY_UI');
