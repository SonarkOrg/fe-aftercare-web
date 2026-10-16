import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RetentionRun, RetentionSettings, RetentionSettingsRequest } from '../models/retention.model';

@Injectable({ providedIn: 'root' })
export class RetentionService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  settings(): Observable<RetentionSettings> {
    return this.http.get<RetentionSettings>(`${this.base}/settings/retention`);
  }

  save(req: RetentionSettingsRequest): Observable<RetentionSettings> {
    return this.http.put<RetentionSettings>(`${this.base}/settings/retention`, req);
  }

  /** Counts only: nothing is deleted. */
  dryRun(): Observable<RetentionRun> {
    return this.http.post<RetentionRun>(`${this.base}/retention/dry-run`, {});
  }

  runs(): Observable<RetentionRun[]> {
    return this.http.get<RetentionRun[]>(`${this.base}/retention/runs`);
  }
}
