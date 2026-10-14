import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckIn, CreateFollowUpRequest, FollowUp, FollowUpWithCode } from '../models/follow-up.model';

@Injectable({ providedIn: 'root' })
export class FollowUpService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  create(patientId: number, req: CreateFollowUpRequest): Observable<FollowUpWithCode> {
    return this.http.post<FollowUpWithCode>(`${this.base}/patients/${patientId}/follow-ups`, req);
  }

  listForPatient(patientId: number): Observable<FollowUp[]> {
    return this.http.get<FollowUp[]>(`${this.base}/patients/${patientId}/follow-ups`);
  }

  regenerateCode(id: number): Observable<FollowUpWithCode> {
    return this.http.post<FollowUpWithCode>(`${this.base}/follow-ups/${id}/access-code`, {});
  }

  close(id: number): Observable<FollowUp> {
    return this.http.post<FollowUp>(`${this.base}/follow-ups/${id}/close`, {});
  }

  checkInsForPatient(patientId: number): Observable<CheckIn[]> {
    return this.http.get<CheckIn[]>(`${this.base}/patients/${patientId}/check-ins`);
  }
}
