import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Patient } from '../models/patient.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PatientService {

  private API_URL = `${environment.apiUrl}/patients`;

  constructor(private http: HttpClient) {}

  addPatient(patient: Patient): Observable<Patient> {
    return this.http.post<Patient>(`${this.API_URL}/register`, patient);
  }

  getPatientList(): Observable<Patient[]> {
    return this.http.get<Patient[]>(this.API_URL);
  }

  getPatient(patientId: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.API_URL}/${patientId}`);
  }

  deletePatient(patientId: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${patientId}`);
  }
}
