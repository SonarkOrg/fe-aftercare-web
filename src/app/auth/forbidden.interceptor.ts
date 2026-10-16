import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { isStaffApiUrl } from '../auth.config';
import { apiErrorOf } from '../models/api-error.model';
import { Permissions } from './permissions.service';

/**
 * A 403 NOT_STAFF on any staff call means the login lost (or never had) its staff link: forget the member and go to
 * /not-staff. FORBIDDEN passes through for the component to show. Services are resolved lazily: Permissions needs
 * HttpClient, which needs the interceptors.
 */
@Injectable()
export class ForbiddenInterceptor implements HttpInterceptor {
  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!isStaffApiUrl(req.url)) {
      return next.handle(req);
    }
    return next.handle(req).pipe(
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 403 && apiErrorOf(err)?.error === 'NOT_STAFF') {
          this.injector.get(Permissions).reset();
          const router = this.injector.get(Router);
          if (!router.url.startsWith('/not-staff')) {
            router.navigateByUrl('/not-staff');
          }
        }
        return throwError(() => err);
      })
    );
  }
}
