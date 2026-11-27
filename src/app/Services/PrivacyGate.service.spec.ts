import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { PrivacyGate } from '../models/privacy-gate.model';
import { PrivacyGateService } from './PrivacyGate.service';

describe('PrivacyGateService (PRIV-A-40 contract)', () => {
  const url = `${environment.apiUrl}/settings/privacy-gates`;
  let svc: PrivacyGateService;
  let http: HttpTestingController;
  const gate = (over: Partial<PrivacyGate> = {}): PrivacyGate => ({ gate: 'NAM_COLLECTION', enabled: false, decisionRef: null, decidedAt: null, decidedByName: null, ...over });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    svc = TestBed.inject(PrivacyGateService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists the switches', () => {
    let got: PrivacyGate[] = [];
    svc.list().subscribe(g => (got = g));
    const r = http.expectOne(url);
    expect(r.request.method).toBe('GET');
    r.flush([gate(), gate({ gate: 'HEALTH_CARD_CAPTURE' })]);
    expect(got.map(g => g.gate)).toEqual(['NAM_COLLECTION', 'HEALTH_CARD_CAPTURE']);
  });

  it('puts one switch with its decision reference', () => {
    svc.set('HEALTH_CARD_CAPTURE', { enabled: true, decisionRef: 'Q1 2026-11-30' }).subscribe();
    const r = http.expectOne(`${url}/HEALTH_CARD_CAPTURE`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ enabled: true, decisionRef: 'Q1 2026-11-30' });
    r.flush(gate({ gate: 'HEALTH_CARD_CAPTURE', enabled: true }));
  });
});
