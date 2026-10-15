import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DocumentCategory, PatientDocument } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(patientId: number): Observable<PatientDocument[]> {
    return this.http.get<PatientDocument[]>(`${this.base}/patients/${patientId}/documents`);
  }

  /** multipart/form-data; the Content-Type header (with its boundary) is set by the browser, never by us. */
  upload(patientId: number, file: File, category: DocumentCategory, title?: string): Observable<PatientDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    if (title && title.trim()) {
      form.append('title', title.trim());
    }
    return this.http.post<PatientDocument>(`${this.base}/patients/${patientId}/documents`, form);
  }

  content(docId: number): Observable<Blob> {
    return this.http.get(`${this.base}/documents/${docId}/content`, { responseType: 'blob' });
  }

  remove(docId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/documents/${docId}/delete`, { reason });
  }
}
