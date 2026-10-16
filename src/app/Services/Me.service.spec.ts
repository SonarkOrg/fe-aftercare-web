import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { me } from '../testing/fixtures';
import { MeService } from './Me.service';

describe('MeService', () => {
  it('GETs /api/me', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const http = TestBed.inject(HttpTestingController);
    let got: unknown;
    TestBed.inject(MeService).load().subscribe(m => (got = m));
    const r = http.expectOne(`${environment.apiUrl}/me`);
    expect(r.request.method).toBe('GET');
    r.flush(me('ADMIN'));
    expect(got).toEqual(me('ADMIN'));
    http.verify();
  });
});
