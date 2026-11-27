import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PrivacyGate, PrivacyGateKey, PrivacyGateRequest } from '../models/privacy-gate.model';

/** Privacy switches (PRIV-A-40, SETTINGS_MANAGE). Wave-2 contract: the API answers 501 until A-40 is built. */
@Injectable({ providedIn: 'root' })
export class PrivacyGateService {
  private readonly url = `${environment.apiUrl}/settings/privacy-gates`;

  constructor(private http: HttpClient) {}

  list(): Observable<PrivacyGate[]> {
    return this.http.get<PrivacyGate[]>(this.url);
  }

  set(gate: PrivacyGateKey, req: PrivacyGateRequest): Observable<PrivacyGate> {
    return this.http.put<PrivacyGate>(`${this.url}/${gate}`, req);
  }
}
