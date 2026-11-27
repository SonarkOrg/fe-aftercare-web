import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DuplicateFlag, DuplicateFlagCreated, HealthCardRequest, HealthCardResponse, PatientSearchRequest, PatientSearchResult,
  QuickPatientRequest, QuickPatientResponse
} from '../models/arrival.model';
import { ContactConsent } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class PatientDeskService {
  private readonly base = `${environment.apiUrl}/patients`;

  constructor(private http: HttpClient) {}

  /** Records the answer to "does the patient accept clinic messages?" without touching channel or language. */
  setConsent(patientId: number, contactConsent: 'GRANTED' | 'WITHDRAWN'): Observable<{ contactConsent: ContactConsent }> {
    return this.http.put<{ contactConsent: ContactConsent }>(`${this.base}/${patientId}/contact-consent`, { contactConsent });
  }

  /**
   * One of the three forms. A health number is sent in the body only, never in a URL, and callers must not keep it
   * (the Arrivals page empties the box before this request leaves).
   */
  search(body: PatientSearchRequest): Observable<PatientSearchResult> {
    return this.http.post<PatientSearchResult>(`${this.base}/search`, body);
  }

  /** Quick create from the desk (three fields). 409 POSSIBLE_DUPLICATE / HEALTH_NUMBER_IN_USE carry `details.candidates`. */
  quickCreate(body: QuickPatientRequest): Observable<QuickPatientResponse> {
    return this.http.post<QuickPatientResponse>(`${this.base}/quick`, body);
  }

  setHealthCard(patientId: number, body: HealthCardRequest): Observable<HealthCardResponse> {
    return this.http.put<HealthCardResponse>(`${this.base}/${patientId}/health-card`, body);
  }

  /** Desk undo: only a card the caller attached in the last 10 minutes. */
  removeHealthCard(patientId: number): Observable<HealthCardResponse> {
    return this.http.delete<HealthCardResponse>(`${this.base}/${patientId}/health-card`);
  }

  flagDuplicate(patientId: number, otherPatientId: number): Observable<DuplicateFlagCreated> {
    return this.http.post<DuplicateFlagCreated>(`${this.base}/${patientId}/duplicate-flags`, { otherPatientId });
  }

  duplicateFlags(): Observable<DuplicateFlag[]> {
    return this.http.get<DuplicateFlag[]>(`${this.base}/duplicate-flags`, { params: { status: 'OPEN' } });
  }

  /** The OPEN flags of one patient (the patient file): audits only that pair, never the clinic-wide list. */
  duplicateFlagsOf(patientId: number): Observable<DuplicateFlag[]> {
    return this.http.get<DuplicateFlag[]>(`${this.base}/${patientId}/duplicate-flags`, { params: { status: 'OPEN' } });
  }

  clearDuplicateFlag(patientId: number, flagId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${patientId}/duplicate-flags/${flagId}/clear`, {});
  }
}
