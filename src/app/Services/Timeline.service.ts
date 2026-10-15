import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CareNote, NoteCreateRequest, Page, TimelineCategory, TimelineItem } from '../models/timeline.model';

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  timeline(patientId: number, categories: TimelineCategory[], page = 0, size = 30): Observable<Page<TimelineItem>> {
    let params = new HttpParams();
    for (const c of categories) {
      params = params.append('category', c);
    }
    params = params.set('page', page).set('size', size);
    return this.http.get<Page<TimelineItem>>(`${this.base}/patients/${patientId}/timeline`, { params });
  }

  addNote(patientId: number, req: NoteCreateRequest): Observable<CareNote> {
    return this.http.post<CareNote>(`${this.base}/patients/${patientId}/notes`, req);
  }

  editNote(noteId: number, body: string): Observable<CareNote> {
    return this.http.put<CareNote>(`${this.base}/notes/${noteId}`, { body });
  }

  deleteNote(noteId: number, reason: string): Observable<CareNote> {
    return this.http.post<CareNote>(`${this.base}/notes/${noteId}/delete`, { reason });
  }
}
