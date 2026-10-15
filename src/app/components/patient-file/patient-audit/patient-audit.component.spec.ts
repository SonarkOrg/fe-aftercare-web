import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { AuditEvent } from '../../../models/audit.model';
import { PatientAuditComponent } from './patient-audit.component';

describe('PatientAuditComponent', () => {
  let fixture: ComponentFixture<PatientAuditComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/patients/5/audit`;
  const ev = (over: Partial<AuditEvent> = {}): AuditEvent => ({
    id: 1, occurredAt: '2026-10-14T18:30:00Z', actorName: 'Dev Nurse', actorSub: 'dev|nurse-1', action: 'HEALTH_NUMBER_REVEALED',
    resourceType: 'HEALTH_NUMBER', resourceId: null, detail: 'reason: billing', ...over
  });
  const audit = () => http.expectOne(r => r.url === url);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HttpClientTestingModule], declarations: [PatientAuditComponent] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientAuditComponent);
    fixture.componentInstance.patientId = 5;
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  it('renders rows with humanized actions, Toronto time, item ids and details', () => {
    fixture.detectChanges();
    const r = audit();
    expect(r.request.params.get('page')).toBe('0');
    expect(r.request.params.get('size')).toBe('50');
    r.flush({ items: [ev(), ev({ id: 2, action: 'NOTE_CREATED', resourceType: 'NOTE', resourceId: 30, detail: null, actorName: null })], page: 0, size: 50, hasMore: false });
    fixture.detectChanges();
    expect(el.querySelector('caption.sr-only')!.textContent).toBe('Access log');
    expect(el.querySelector('.audit-help')!.textContent).toContain('Every view of this file, reveal of the health number, and change is recorded.');
    const rows = Array.from(el.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent!.trim()));
    expect(rows[0]).toEqual(['2026-10-14 14:30', 'Dev Nurse', 'Health number revealed', 'Health number', 'reason: billing']);
    expect(rows[1]).toEqual(['2026-10-14 14:30', 'dev|nurse-1', 'Note created', 'Note #30', '—']);
    expect(el.querySelector('.load-more')).toBeNull();
  });

  it('Load more appends the next page', () => {
    fixture.detectChanges();
    audit().flush({ items: [ev()], page: 0, size: 50, hasMore: true });
    fixture.detectChanges();
    (el.querySelector('.load-more') as HTMLButtonElement).click();
    const r = audit();
    expect(r.request.params.get('page')).toBe('1');
    r.flush({ items: [ev({ id: 2, action: 'PATIENT_FILE_VIEWED', resourceType: 'PATIENT', resourceId: 5, detail: null })], page: 1, size: 50, hasMore: false });
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('.load-more')).toBeNull();
  });

  it('shows an error with a retry', () => {
    fixture.detectChanges();
    audit().flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Could not load the access log');
  });
});
