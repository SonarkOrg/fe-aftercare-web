import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { QuestionnaireDefinition, QuestionnaireDefinitionDetail } from '../models/questionnaire-definition.model';

@Injectable({ providedIn: 'root' })
export class QuestionnaireDefinitionService {
  private readonly base = `${environment.apiUrl}/questionnaires`;
  // Definitions are immutable per id, so detail responses are cached.
  private readonly cache = new Map<number, Observable<QuestionnaireDefinitionDetail>>();

  constructor(private http: HttpClient) {}

  list(): Observable<QuestionnaireDefinition[]> {
    return this.http.get<QuestionnaireDefinition[]>(this.base);
  }

  get(id: number): Observable<QuestionnaireDefinitionDetail> {
    let cached = this.cache.get(id);
    if (!cached) {
      cached = this.http.get<QuestionnaireDefinitionDetail>(`${this.base}/${id}`).pipe(shareReplay(1));
      this.cache.set(id, cached);
    }
    return cached;
  }
}
