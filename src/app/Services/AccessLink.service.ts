import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RevokedLinks } from '../models/privacy-gate.model';

/** Link revocation without reissue (PRIV-A-06). No body; answers 200 { revoked } (n may be 0). */
@Injectable({ providedIn: 'root' })
export class AccessLinkService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** CLINICAL_WRITE. */
  revokeFollowUp(followUpId: number): Observable<RevokedLinks> {
    return this.http.post<RevokedLinks>(`${this.api}/follow-ups/${followUpId}/access-code/revoke`, null);
  }

  /** APPOINTMENT_WRITE (reception included). */
  revokeAppointment(appointmentId: number): Observable<RevokedLinks> {
    return this.http.post<RevokedLinks>(`${this.api}/appointments/${appointmentId}/access-code/revoke`, null);
  }

  /** PATIENT_WRITE: every live link of every follow-up and appointment of the patient. */
  revokeAllForPatient(patientId: number): Observable<RevokedLinks> {
    return this.http.post<RevokedLinks>(`${this.api}/patients/${patientId}/access-links/revoke`, null);
  }
}
