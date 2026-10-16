import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Lang } from '../i18n/i18n.types';
import { Me } from '../models/me.model';

@Injectable({ providedIn: 'root' })
export class MeService {
  constructor(private http: HttpClient) {}

  load(): Observable<Me> {
    return this.http.get<Me>(`${environment.apiUrl}/me`);
  }

  /** Saves the person's own UI language. */
  updatePreferences(lang: Lang): Observable<Me> {
    return this.http.put<Me>(`${environment.apiUrl}/me/preferences`, { uiLanguage: lang === 'fr' ? 'FR' : 'EN' });
  }
}
