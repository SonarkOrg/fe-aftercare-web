import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Appointment, AppointmentDetail, AppointmentMetrics, AppointmentStatus, AppointmentStatusRequest,
  AppointmentWithCode, CreateAppointmentRequest, UpdateAppointmentRequest
} from '../models/appointment.model';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly base = `${environment.apiUrl}/appointments`;

  constructor(private http: HttpClient) {}

  list(from: string, to: string, statuses?: AppointmentStatus[]): Observable<Appointment[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    for (const s of statuses ?? []) {
      params = params.append('status', s);
    }
    return this.http.get<Appointment[]>(this.base, { params });
  }

  metrics(from: string, to: string): Observable<AppointmentMetrics> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<AppointmentMetrics>(`${this.base}/metrics`, { params });
  }

  get(id: number): Observable<AppointmentDetail> {
    return this.http.get<AppointmentDetail>(`${this.base}/${id}`);
  }

  create(req: CreateAppointmentRequest): Observable<AppointmentWithCode> {
    return this.http.post<AppointmentWithCode>(this.base, req);
  }

  update(id: number, req: UpdateAppointmentRequest): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.base}/${id}`, req);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  regenerateCode(id: number): Observable<AppointmentWithCode> {
    return this.http.post<AppointmentWithCode>(`${this.base}/${id}/access-code`, {});
  }

  markReviewed(id: number): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/${id}/review`, {});
  }

  setStatus(id: number, status: AppointmentStatusRequest['status']): Observable<Appointment> {
    const body: AppointmentStatusRequest = { status };
    return this.http.post<Appointment>(`${this.base}/${id}/status`, body);
  }

  listForPatient(patientId: number): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${environment.apiUrl}/patients/${patientId}/appointments`);
  }
}
