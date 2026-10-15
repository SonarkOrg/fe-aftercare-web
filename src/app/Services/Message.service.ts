import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Conversation, Message, Thread, UnreadCount } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  inbox(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.base}/messages/inbox`);
  }

  unreadCount(): Observable<UnreadCount> {
    return this.http.get<UnreadCount>(`${this.base}/messages/unread-count`);
  }

  /** The newest page, or the page of messages older than `before`. The first page writes the "messages viewed" audit row. */
  thread(patientId: number, before?: number): Observable<Thread> {
    let params = new HttpParams();
    if (before !== undefined) {
      params = params.set('before', before);
    }
    return this.http.get<Thread>(`${this.base}/patients/${patientId}/messages`, { params });
  }

  send(patientId: number, body: string): Observable<Message> {
    return this.http.post<Message>(`${this.base}/patients/${patientId}/messages`, { body });
  }

  markRead(patientId: number, upToId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/patients/${patientId}/messages/read`, { upToId });
  }
}
