import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { AuditEvent } from '../../../models/audit.model';
import { ActorSelectComponent } from '../../../shared/actor-select/actor-select.component';
import { staffMember } from '../../../testing/fixtures';
import { PatientAuditComponent } from './patient-audit.component';

describe('PatientAuditComponent', () => {
  let fixture: ComponentFixture<PatientAuditComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/patients/5/audit`;
  const ev = (over: Partial<AuditEvent> = {}): AuditEvent => ({
    id: 1, occurredAt: '2026-10-14T18:30:00Z', actorName: 'Dev Nurse', actorSub: 'dev|nurse-1', action: 'HEALTH_NUMBER_REVEALED',
    resourceType: 'HEALTH_NUMBER', resourceId: null, patientId: 5, detail: 'reason: billing', ...over
  });
  const audit = () => http.expectOne(r => r.url === url);
  const staff = [
    staffMember({ id: 1, displayName: 'Marie Nurse', auth0Subject: 'dev|nurse-1' }),
    staffMember({ id: 2, displayName: 'No Login', auth0Subject: null }),
    staffMember({ id: 3, displayName: 'Sam Doc', auth0Subject: 'auth0|doc' })
  ];
  /** The page loads the log and the directory for the actor filter. */
  const init = (page: object = { items: [ev()], page: 0, size: 50, hasMore: false }) => {
    fixture.detectChanges();
    audit().flush(page);
    http.expectOne(r => r.url === `${environment.apiUrl}/staff`).flush(staff);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HttpClientTestingModule, ActorSelectComponent], declarations: [PatientAuditComponent] }).compileComponents();
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
    expect(r.request.params.has('actorSub')).toBeFalse();
    r.flush({ items: [ev(), ev({ id: 2, action: 'NOTE_CREATED', resourceType: 'NOTE', resourceId: 30, detail: null, actorName: null })], page: 0, size: 50, hasMore: false });
    http.expectOne(r2 => r2.url === `${environment.apiUrl}/staff`).flush([]);
    fixture.detectChanges();
    expect(el.querySelector('caption.sr-only')!.textContent).toBe('Access log');
    expect(el.querySelector('.audit-help')!.textContent).toContain('Every view of this file, reveal of the health number, and change is recorded.');
    const rows = Array.from(el.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent!.trim()));
    expect(rows[0]).toEqual(['2026-10-14 14:30', 'Dev Nurse', 'Health number revealed', 'Health number', 'reason: billing']);
    expect(rows[1]).toEqual(['2026-10-14 14:30', 'dev|nurse-1', 'Note created', 'Note #30', '—']);
    expect(el.querySelector('.load-more')).toBeNull();
  });

  it('Load more appends the next page', () => {
    init({ items: [ev()], page: 0, size: 50, hasMore: true });
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
    http.expectOne(r => r.url === `${environment.apiUrl}/staff`).flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Could not load the access log');
  });

  describe('actor filter', () => {
    const select = () => el.querySelector<HTMLSelectElement>('#audit-actor')!;
    const choose = (label: string) => {
      select().selectedIndex = Array.from(select().options).findIndex(o => o.textContent!.trim() === label);
      select().dispatchEvent(new Event('change'));
    };

    it('offers "All staff" and the directory members that have a login, by name', () => {
      init();
      expect(Array.from(select().options).map(o => o.textContent!.trim())).toEqual(['All staff', 'Marie Nurse', 'Sam Doc']);
      expect(select().selectedOptions[0].textContent!.trim()).toBe('All staff');
      expect(el.querySelector('label[for=audit-actor]')!.textContent).toBe('Actor');
    });

    it('choosing an actor reloads page 0 with actorSub, and "All staff" drops it again', () => {
      init({ items: [ev()], page: 0, size: 50, hasMore: true });
      (el.querySelector('.load-more') as HTMLButtonElement).click();
      audit().flush({ items: [ev({ id: 2 })], page: 1, size: 50, hasMore: false });
      fixture.detectChanges();

      choose('Sam Doc');
      const r = audit();
      expect(r.request.params.get('page')).toBe('0');
      expect(r.request.params.get('actorSub')).toBe('auth0|doc');
      r.flush({ items: [ev({ id: 3, actorSub: 'auth0|doc', actorName: 'Sam Doc' })], page: 0, size: 50, hasMore: false });
      fixture.detectChanges();
      expect(el.querySelectorAll('tbody tr').length).toBe(1);

      choose('All staff');
      const all = audit();
      expect(all.request.params.has('actorSub')).toBeFalse();
      expect(all.request.params.get('page')).toBe('0');
      all.flush({ items: [], page: 0, size: 50, hasMore: false });
      fixture.detectChanges();
      expect(el.textContent).toContain('No access recorded yet.');
    });

    it('Load more keeps the chosen actor', () => {
      init();
      choose('Marie Nurse');
      audit().flush({ items: [ev()], page: 0, size: 50, hasMore: true });
      fixture.detectChanges();
      (el.querySelector('.load-more') as HTMLButtonElement).click();
      const r = audit();
      expect(r.request.params.get('page')).toBe('1');
      expect(r.request.params.get('actorSub')).toBe('dev|nurse-1');
      r.flush({ items: [], page: 1, size: 50, hasMore: false });
    });

    it('still works when the directory cannot be loaded (only "All staff")', () => {
      fixture.detectChanges();
      audit().flush({ items: [ev()], page: 0, size: 50, hasMore: false });
      http.expectOne(r => r.url === `${environment.apiUrl}/staff`).flush('x', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(Array.from(select().options).map(o => o.textContent!.trim())).toEqual(['All staff']);
    });
  });
});
