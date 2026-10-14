import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Alert, AlertStatus, ResolveAlertRequest } from '../models/alert.model';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(statuses?: AlertStatus[]): Observable<Alert[]> {
    let params = new HttpParams();
    for (const s of statuses ?? []) {
      params = params.append('status', s);
    }
    return this.http.get<Alert[]>(`${this.base}/alerts`, { params });
  }

  listForPatient(patientId: number): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.base}/patients/${patientId}/alerts`);
  }

  acknowledge(id: number): Observable<Alert> {
    return this.http.post<Alert>(`${this.base}/alerts/${id}/acknowledge`, {});
  }

  resolve(id: number, note: string): Observable<Alert> {
    const body: ResolveAlertRequest = { note };
    return this.http.post<Alert>(`${this.base}/alerts/${id}/resolve`, body);
  }
}
