import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContactConsent } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class PatientDeskService {
  private readonly base = `${environment.apiUrl}/patients`;

  constructor(private http: HttpClient) {}

  /** Records the answer to "does the patient accept clinic messages?" without touching channel or language. */
  setConsent(patientId: number, contactConsent: 'GRANTED' | 'WITHDRAWN'): Observable<{ contactConsent: ContactConsent }> {
    return this.http.put<{ contactConsent: ContactConsent }>(`${this.base}/${patientId}/contact-consent`, { contactConsent });
  }
}
