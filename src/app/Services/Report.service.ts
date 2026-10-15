import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReportSummary } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(private http: HttpClient) {}

  summary(from: string, to: string): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${environment.apiUrl}/reports/summary`, { params: new HttpParams().set('from', from).set('to', to) });
  }
}
