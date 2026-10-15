import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuditEvent } from '../models/audit.model';
import { Page } from '../models/timeline.model';

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private http: HttpClient) {}

  list(patientId: number, page = 0, size = 50): Observable<Page<AuditEvent>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AuditEvent>>(`${environment.apiUrl}/patients/${patientId}/audit`, { params });
  }
}
