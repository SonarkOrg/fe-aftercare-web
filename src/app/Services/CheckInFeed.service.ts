import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckIn } from '../models/follow-up.model';

/** All patients' check-ins in [from, to] (at most 31 days): GET /api/check-ins. */
@Injectable({ providedIn: 'root' })
export class CheckInFeedService {
  constructor(private http: HttpClient) {}

  range(from: string, to: string): Observable<CheckIn[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CheckIn[]>(`${environment.apiUrl}/check-ins`, { params });
  }
}
