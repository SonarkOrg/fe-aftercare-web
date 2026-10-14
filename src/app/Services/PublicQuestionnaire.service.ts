import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FhirQuestionnaireResponse } from '../fhir/fhir.model';
import { PublicSession, PublicSubmitResult } from '../models/public-session.model';

/** Public (no auth) endpoints; the access code travels in the path. */
@Injectable({ providedIn: 'root' })
export class PublicQuestionnaireService {
  private readonly base = `${environment.apiUrl}/public/q`;

  constructor(private http: HttpClient) {}

  get(code: string): Observable<PublicSession> {
    return this.http.get<PublicSession>(`${this.base}/${encodeURIComponent(code)}`);
  }

  submit(code: string, response: FhirQuestionnaireResponse): Observable<PublicSubmitResult> {
    return this.http.post<PublicSubmitResult>(`${this.base}/${encodeURIComponent(code)}`, response);
  }
}
