import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArrivalRow, Arrivals } from '../models/arrival.model';

@Injectable({ providedIn: 'root' })
export class ArrivalService {
  private readonly base = `${environment.apiUrl}/appointments`;

  constructor(private http: HttpClient) {}

  /** One business day of the arrivals screen; `date` (YYYY-MM-DD) defaults to today on the server. */
  list(date?: string): Observable<Arrivals> {
    const params = date ? new HttpParams().set('date', date) : new HttpParams();
    return this.http.get<Arrivals>(`${this.base}/arrivals`, { params });
  }

  arrive(id: number): Observable<ArrivalRow> {
    return this.http.post<ArrivalRow>(`${this.base}/${id}/arrival`, {});
  }

  undo(id: number): Observable<ArrivalRow> {
    return this.http.delete<ArrivalRow>(`${this.base}/${id}/arrival`);
  }
}
