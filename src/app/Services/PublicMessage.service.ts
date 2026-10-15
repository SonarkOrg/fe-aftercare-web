import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PublicMessage, PublicThread } from '../models/message.model';

/** Public (no auth) endpoints; the access code travels in the path and the staff token is never attached. */
@Injectable({ providedIn: 'root' })
export class PublicMessageService {
  constructor(private http: HttpClient) {}

  private url(code: string): string {
    return `${environment.apiUrl}/public/q/${encodeURIComponent(code)}/messages`;
  }

  thread(code: string, before?: number): Observable<PublicThread> {
    let params = new HttpParams();
    if (before !== undefined) {
      params = params.set('before', before);
    }
    return this.http.get<PublicThread>(this.url(code), { params });
  }

  send(code: string, body: string): Observable<PublicMessage> {
    return this.http.post<PublicMessage>(this.url(code), { body });
  }

  markRead(code: string, upToId: number): Observable<void> {
    return this.http.post<void>(`${this.url(code)}/read`, { upToId });
  }
}
