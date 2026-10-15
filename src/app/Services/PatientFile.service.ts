import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Allergy, AllergyRequest, CareTeamAssignRequest, CareTeamMember, Diagnosis, DiagnosisRequest, EmergencyContact,
  EmergencyContactRequest, HealthNumberMasked, HealthNumberReveal, Medication, MedicationRequest, MedicalList, PatientMedical,
  Procedure, ProcedureRequest
} from '../models/medical.model';
import { Patient } from '../models/patient.model';

export interface MedicalItemMap {
  allergies: { dto: Allergy; req: AllergyRequest };
  medications: { dto: Medication; req: MedicationRequest };
  procedures: { dto: Procedure; req: ProcedureRequest };
  diagnoses: { dto: Diagnosis; req: DiagnosisRequest };
}

@Injectable({ providedIn: 'root' })
export class PatientFileService {
  private readonly base = `${environment.apiUrl}/patients`;

  constructor(private http: HttpClient) {}

  updatePatient(id: number, patient: Patient): Observable<Patient> {
    return this.http.put<Patient>(`${this.base}/${id}`, patient);
  }

  /** Writes the "file viewed" access-audit row on the server: call once per page visit. */
  medical(id: number): Observable<PatientMedical> {
    return this.http.get<PatientMedical>(`${this.base}/${id}/medical`);
  }

  setHealthNumber(id: number, healthNumber: string): Observable<HealthNumberMasked> {
    return this.http.put<HealthNumberMasked>(`${this.base}/${id}/health-number`, { healthNumber });
  }

  clearHealthNumber(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/health-number`);
  }

  revealHealthNumber(id: number, reason: string): Observable<HealthNumberReveal> {
    return this.http.post<HealthNumberReveal>(`${this.base}/${id}/health-number/reveal`, { reason });
  }

  addItem<L extends MedicalList>(id: number, list: L, req: MedicalItemMap[L]['req']): Observable<MedicalItemMap[L]['dto']> {
    return this.http.post<MedicalItemMap[L]['dto']>(`${this.base}/${id}/${list}`, req);
  }

  updateItem<L extends MedicalList>(id: number, list: L, itemId: number, req: MedicalItemMap[L]['req']): Observable<MedicalItemMap[L]['dto']> {
    return this.http.put<MedicalItemMap[L]['dto']>(`${this.base}/${id}/${list}/${itemId}`, req);
  }

  removeItem(id: number, list: MedicalList, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/${list}/${itemId}`);
  }

  contacts(id: number): Observable<EmergencyContact[]> {
    return this.http.get<EmergencyContact[]>(`${this.base}/${id}/emergency-contacts`);
  }

  addContact(id: number, req: EmergencyContactRequest): Observable<EmergencyContact> {
    return this.http.post<EmergencyContact>(`${this.base}/${id}/emergency-contacts`, req);
  }

  updateContact(id: number, contactId: number, req: EmergencyContactRequest): Observable<EmergencyContact> {
    return this.http.put<EmergencyContact>(`${this.base}/${id}/emergency-contacts/${contactId}`, req);
  }

  removeContact(id: number, contactId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/emergency-contacts/${contactId}`);
  }

  careTeam(id: number): Observable<CareTeamMember[]> {
    return this.http.get<CareTeamMember[]>(`${this.base}/${id}/care-team`);
  }

  assignCareTeam(id: number, req: CareTeamAssignRequest): Observable<CareTeamMember> {
    return this.http.post<CareTeamMember>(`${this.base}/${id}/care-team`, req);
  }

  unassignCareTeam(id: number, assignmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/care-team/${assignmentId}`);
  }
}
