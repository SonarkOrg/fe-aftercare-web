import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { AuditEvent } from '../../../models/audit.model';
import { ActorSelectComponent } from '../../../shared/actor-select/actor-select.component';
import { addDays, businessToday } from '../../../shared/link.util';
import { staffMember } from '../../../testing/fixtures';
import { AccessLogComponent } from './access-log.component';

describe('AccessLogComponent', () => {
  const api = environment.apiUrl;
  const today = businessToday();
  let fixture: ComponentFixture<AccessLogComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const ev = (over: Partial<AuditEvent> = {}): AuditEvent => ({
    id: 1, occurredAt: '2026-10-14T18:30:00Z', actorName: 'Dev Nurse', actorSub: 'dev|nurse-1', action: 'HEALTH_NUMBER_REVEALED',
    resourceType: 'HEALTH_NUMBER', resourceId: null, patientId: 5, detail: 'reason: billing', ...over
  });
  const page = (items: AuditEvent[], hasMore = false, p = 0) => ({ items, page: p, size: 50, hasMore });
  const staff = [staffMember({ id: 1, displayName: 'Marie Nurse', auth0Subject: 'dev|nurse-1' }), staffMember({ id: 3, displayName: 'Sam Doc', auth0Subject: 'auth0|doc' })];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule, ActorSelectComponent],
      declarations: [AccessLogComponent]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccessLogComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const audit = () => http.expectOne(r => r.url === `${api}/audit`);
  async function init(first = page([ev()])) {
    await settle();
    audit().flush(first);
    http.expectOne(r => r.url === `${api}/staff`).flush(staff);
    await settle();
  }
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const set = async (sel: string, value: string, event = 'input') => {
    const c = q<HTMLInputElement | HTMLSelectElement>(sel);
    c.value = value;
    c.dispatchEvent(new Event(event));
    await settle();
  };
  const apply = async () => {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await settle();
  };

  it('loads the last 30 days by default (from and to are sent), 50 per page, no other filter', async () => {
    await settle();
    const r = audit();
    expect(r.request.params.get('from')).toBe(addDays(today, -29));
    expect(r.request.params.get('to')).toBe(today);
    expect(r.request.params.get('page')).toBe('0');
    expect(r.request.params.get('size')).toBe('50');
    for (const k of ['actorSub', 'action', 'patientId']) {
      expect(r.request.params.has(k)).withContext(k).toBeFalse();
    }
    r.flush(page([]));
    http.expectOne(r2 => r2.url === `${api}/staff`).flush(staff);
    await settle();
    expect(q<HTMLInputElement>('#al-from').value).toBe(addDays(today, -29));
    expect(q<HTMLInputElement>('#al-to').value).toBe(today);
  });

  it('renders When, Actor, Action, Resource, Patient (a link to the patient access log) and Detail', async () => {
    await init(page([ev(), ev({ id: 2, actorName: null, actorSub: 'system:retention', action: 'RETENTION_DRY_RUN', resourceType: 'RETENTION', patientId: null, detail: 'followUps=3' }),
      ev({ id: 3, action: 'ACCESS_DENIED', resourceType: 'ENDPOINT', patientId: 7, detail: 'GET /api/patients/*/medical' })]));
    expect(Array.from(el.querySelectorAll('thead th')).map(t => t.textContent)).toEqual(['When', 'Actor', 'Action', 'Resource', 'Patient', 'Detail']);
    const rows = Array.from(el.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent!.trim()));
    expect(rows[0]).toEqual(['2026-10-14 14:30', 'Dev Nurse', 'Health number revealed', 'Health number', '#5', 'reason: billing']);
    expect(rows[1]).toEqual(['2026-10-14 14:30', 'system:retention', 'Retention dry run', 'Retention', '—', 'followUps=3']);
    expect(rows[2][2]).toBe('Access denied');
    const link = el.querySelectorAll<HTMLAnchorElement>('.patient-link');
    expect(link.length).toBe(2);
    expect(link[0].getAttribute('href')).toBe('/patients/5?tab=audit');
    expect(link[1].getAttribute('href')).toBe('/patients/7?tab=audit');
  });

  it('maps the filters onto actorSub, action, patientId, from and to, and starts again at page 0', async () => {
    await init();
    const actor = q<HTMLSelectElement>('#al-actor');
    actor.selectedIndex = Array.from(actor.options).findIndex(o => o.textContent!.includes('Doc'));
    actor.dispatchEvent(new Event('change'));
    await settle();
    await set('#al-action', 'HEALTH_NUMBER_REVEALED', 'change');
    await set('#al-patient', '5');
    await set('#al-from', '2026-09-01', 'input');
    await set('#al-to', '2026-10-01', 'input');
    http.expectNone(r => r.url === `${api}/audit`); // nothing is sent until Apply
    await apply();
    const r = audit();
    expect(r.request.params.get('actorSub')).toBe('auth0|doc');
    expect(r.request.params.get('action')).toBe('HEALTH_NUMBER_REVEALED');
    expect(r.request.params.get('patientId')).toBe('5');
    expect(r.request.params.get('from')).toBe('2026-09-01');
    expect(r.request.params.get('to')).toBe('2026-10-01');
    expect(r.request.params.get('page')).toBe('0');
    r.flush(page([]));
    await settle();
    expect(el.textContent).toContain('No entries match these filters.');
  });

  it('lists every audit action, humanized', async () => {
    await init();
    const options = Array.from(q<HTMLSelectElement>('#al-action').options).map(o => o.textContent!.trim());
    expect(options[0]).toBe('All actions');
    for (const label of ['Access denied', 'Staff role changed', 'Notification requested', 'Retention purge', 'Contact preferences updated', 'Patient file viewed']) {
      expect(options).toContain(label);
    }
  });

  it('Load more appends the next page with the same filters', async () => {
    await init(page([ev()], true));
    await set('#al-patient', '9'); // edited but not applied: Load more keeps the applied query
    q<HTMLButtonElement>('.load-more').click();
    const r = audit();
    expect(r.request.params.get('page')).toBe('1');
    expect(r.request.params.has('patientId')).toBeFalse();
    r.flush(page([ev({ id: 2 })], false, 1));
    await settle();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(q('.load-more')).toBeNull();
  });

  it('Reset goes back to everyone and the default 30 days', async () => {
    await init();
    await set('#al-from', '2026-01-01');
    await set('#al-patient', '5');
    q<HTMLButtonElement>('.reset-filters').click();
    const r = audit();
    expect(r.request.params.get('from')).toBe(addDays(today, -29));
    expect(r.request.params.has('patientId')).toBeFalse();
    r.flush(page([]));
    await settle();
  });

  it('refuses a start after the end and ranges over 366 days, without a request', async () => {
    await init();
    await set('#al-from', '2026-10-10');
    await set('#al-to', '2026-10-01');
    await apply();
    expect(q('.field-error').textContent).toBe('The start date must not be after the end date.');
    await set('#al-from', '2024-01-01');
    await set('#al-to', '2026-10-01');
    await apply();
    expect(q('.field-error').textContent).toBe('The range must not exceed 366 days.');
    http.expectNone(r => r.url === `${api}/audit`);
  });

  it('shows an error banner with a retry', async () => {
    await settle();
    audit().flush('x', { status: 500, statusText: 'Server Error' });
    http.expectOne(r => r.url === `${api}/staff`).flush(staff);
    await settle();
    expect(q('.banner--error').textContent).toContain('Could not load the access log.');
    q<HTMLButtonElement>('.retry').click();
    audit().flush(page([ev()]));
    await settle();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('a FORBIDDEN answer is explained', async () => {
    await settle();
    audit().flush({ status: 403, error: 'FORBIDDEN', message: 'x', fieldErrors: {} }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(r => r.url === `${api}/staff`).flush(staff);
    await settle();
    expect(q('.banner--error').textContent).toContain("You don't have permission for this action.");
  });
});
