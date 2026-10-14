import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, switchMap, take } from 'rxjs';
import { isStaffApiUrl } from '../auth.config';
import { StaffAuth } from './staff-auth';

/** Attaches the staff bearer token to allow-listed staff API URLs only (never /public or /dev). */
@Injectable()
export class StaffAuthInterceptor implements HttpInterceptor {
  constructor(private auth: StaffAuth) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!isStaffApiUrl(req.url)) {
      return next.handle(req);
    }
    return this.auth.getAccessToken().pipe(
      take(1),
      switchMap(token => next.handle(req.clone({ setHeaders: { Authorization: 'Bearer ' + token } })))
    );
  }
}
