import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Staff, StaffRequest } from '../models/staff.model';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly base = `${environment.apiUrl}/staff`;

  constructor(private http: HttpClient) {}

  list(includeInactive = false): Observable<Staff[]> {
    return this.http.get<Staff[]>(this.base, { params: new HttpParams().set('includeInactive', includeInactive) });
  }

  create(req: StaffRequest): Observable<Staff> {
    return this.http.post<Staff>(this.base, req);
  }

  update(id: number, req: StaffRequest): Observable<Staff> {
    return this.http.put<Staff>(`${this.base}/${id}`, req);
  }

  deactivate(id: number): Observable<Staff> {
    return this.http.post<Staff>(`${this.base}/${id}/deactivate`, {});
  }

  reactivate(id: number): Observable<Staff> {
    return this.http.post<Staff>(`${this.base}/${id}/reactivate`, {});
  }
}
