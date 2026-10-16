import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuditAction, AuditEvent } from '../models/audit.model';
import { Page } from '../models/timeline.model';

export interface AuditQuery {
  actorSub?: string | null;
  action?: AuditAction | null;
  patientId?: number | null;
  /** Toronto dates, inclusive. */
  from?: string | null;
  to?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private http: HttpClient) {}

  list(patientId: number, page = 0, size = 50, actorSub?: string | null): Observable<Page<AuditEvent>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (actorSub) {
      params = params.set('actorSub', actorSub);
    }
    return this.http.get<Page<AuditEvent>>(`${environment.apiUrl}/patients/${patientId}/audit`, { params });
  }

  /** The global access log (ADMIN). Empty filters are left out of the query. */
  listAll(query: AuditQuery, page = 0, size = 50): Observable<Page<AuditEvent>> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [k, v] of Object.entries(query)) {
      if (v !== null && v !== undefined && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return this.http.get<Page<AuditEvent>>(`${environment.apiUrl}/audit`, { params });
  }
}
