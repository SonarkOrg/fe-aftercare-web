import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArrivalRow, Arrivals, CardNote, WalkInRequest } from '../models/arrival.model';

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

  /** A visit with no appointment: created already arrived, at the desk. Phase 1B. */
  walkIn(body: WalkInRequest): Observable<ArrivalRow> {
    return this.http.post<ArrivalRow>(`${this.base}/walk-in`, body);
  }

  /** Undo of a mistaken walk-in: removed when nothing was filled in, cancelled otherwise. */
  undoWalkIn(id: number): Observable<{ result: 'REMOVED' | 'CANCELLED' }> {
    return this.http.post<{ result: 'REMOVED' | 'CANCELLED' }>(`${this.base}/${id}/walk-in/undo`, {});
  }

  /** The one optional marker for whoever bills; `null` clears it. */
  setCardNote(id: number, note: CardNote | null): Observable<ArrivalRow> {
    return this.http.put<ArrivalRow>(`${this.base}/${id}/card-note`, { note });
  }
}
