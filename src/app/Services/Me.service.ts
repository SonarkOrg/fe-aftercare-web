import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Me } from '../models/me.model';

@Injectable({ providedIn: 'root' })
export class MeService {
  constructor(private http: HttpClient) {}

  load(): Observable<Me> {
    return this.http.get<Me>(`${environment.apiUrl}/me`);
  }
}
