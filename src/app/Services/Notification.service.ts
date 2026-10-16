import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ContactPreferences, ContactPreferencesRequest, NotificationChannel, NotificationItem, SendLinkRequest
} from '../models/notification.model';
import { Page } from '../models/timeline.model';

/** Patient contact preferences and consent, the notification history, and the manual "Send link" actions. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly base = environment.apiUrl;

  private readonly sentSubject = new Subject<number>();
  /** Emits the patient id whenever a link was queued, so open notification histories can refresh. */
  readonly sent$ = this.sentSubject.asObservable();

  constructor(private http: HttpClient) {}

  notifySent(patientId: number): void {
    this.sentSubject.next(patientId);
  }

  preferences(patientId: number): Observable<ContactPreferences> {
    return this.http.get<ContactPreferences>(`${this.base}/patients/${patientId}/contact-preferences`);
  }

  savePreferences(patientId: number, req: ContactPreferencesRequest): Observable<ContactPreferences> {
    return this.http.put<ContactPreferences>(`${this.base}/patients/${patientId}/contact-preferences`, req);
  }

  list(patientId: number, page = 0, size = 20): Observable<Page<NotificationItem>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<NotificationItem>>(`${this.base}/patients/${patientId}/notifications`, { params });
  }

  /** `channel` null = the patient's preferred channel. */
  sendFollowUpLink(followUpId: number, channel: NotificationChannel | null): Observable<NotificationItem> {
    const body: SendLinkRequest = { channel };
    return this.http.post<NotificationItem>(`${this.base}/follow-ups/${followUpId}/send-link`, body);
  }

  sendAppointmentLink(appointmentId: number, channel: NotificationChannel | null): Observable<NotificationItem> {
    const body: SendLinkRequest = { channel };
    return this.http.post<NotificationItem>(`${this.base}/appointments/${appointmentId}/send-link`, body);
  }
}
