import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AlertCountService } from '../../Services/AlertCount.service';
import { alertDto, providePermissions, missedAlert } from '../../testing/fixtures';
import { AlertTableComponent } from '../alert-table/alert-table.component';
import { AlertsComponent } from './alerts.component';

describe('AlertsComponent', () => {
  let fixture: ComponentFixture<AlertsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/alerts`;
  const alertsReq = () => http.expectOne(r => r.url === url);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [AlertsComponent, AlertTableComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), { provide: AlertCountService, useValue: { refresh: jasmine.createSpy('refresh') } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlertsComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('loads open alerts by default (no status param) and renders the table', () => {
    fixture.detectChanges();
    const req = alertsReq();
    expect(req.request.params.keys().length).toBe(0);
    req.flush([alertDto(), alertDto({ id: 2 })]);
    fixture.detectChanges();
    expect(el.querySelectorAll('.alert-row').length).toBe(2);
  });

  it('shows the empty state', () => {
    fixture.detectChanges();
    alertsReq().flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No open alerts.');
  });

  it('the Resolved filter requests status=RESOLVED and sets aria-pressed', () => {
    fixture.detectChanges();
    alertsReq().flush([]);
    (el.querySelector('#filter-resolved') as HTMLButtonElement).click();
    const req = alertsReq();
    expect(req.request.params.getAll('status')).toEqual(['RESOLVED']);
    req.flush([alertDto({ status: 'RESOLVED' })]);
    fixture.detectChanges();
    expect(el.querySelectorAll('.alert-row').length).toBe(1);
    expect(el.querySelector('#filter-resolved')!.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('#filter-open')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('severity tabs show counts and filter client-side', () => {
    fixture.detectChanges();
    alertsReq().flush([alertDto(), alertDto({ id: 2 }), alertDto({ id: 3, severity: 'MEDIUM' })]);
    fixture.detectChanges();
    const high = el.querySelector('[data-severity=HIGH]') as HTMLButtonElement;
    expect(high.getAttribute('aria-label')).toBe('High, 2');
    high.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.alert-row').length).toBe(2);
    expect(high.getAttribute('aria-pressed')).toBe('true');
    (el.querySelector('[data-severity=all]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.alert-row').length).toBe(3);
  });

  it('reloads when the table reports a change', () => {
    fixture.detectChanges();
    alertsReq().flush([alertDto()]);
    fixture.detectChanges();
    (el.querySelector('.btn-ack') as HTMLButtonElement).click();
    const ack = http.expectOne(`${url}/1/acknowledge`);
    expect(ack.request.method).toBe('POST');
    ack.flush(alertDto({ status: 'ACKNOWLEDGED' }));
    const reload = alertsReq();
    expect(reload.request.method).toBe('GET');
    reload.flush([]);
  });

  it('shows an error when loading fails', () => {
    fixture.detectChanges();
    alertsReq().flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Could not load alerts.');
  });

  it('clears the list on a failed reload and renders no rows next to the error', () => {
    fixture.detectChanges();
    alertsReq().flush([alertDto(), alertDto({ id: 2 })]);
    fixture.detectChanges();
    expect(el.querySelectorAll('.alert-row').length).toBe(2);
    (el.querySelector('#filter-resolved') as HTMLButtonElement).click();
    alertsReq().flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.querySelectorAll('.alert-row').length).toBe(0);
    expect(el.querySelector('app-alert-table')).toBeNull();
    expect(el.textContent).toContain('Could not load alerts.');
    expect(el.textContent).not.toContain('No resolved alerts.');
  });

  it('has the page hero with counts', () => {
    fixture.detectChanges();
    alertsReq().flush([alertDto(), alertDto({ id: 2, status: 'ACKNOWLEDGED' })]);
    fixture.detectChanges();
    expect(el.querySelector('h1')!.textContent).toBe('Alerts');
    expect(el.querySelector('.hero__sub')!.textContent).toBe('1 open · 1 acknowledged');
  });
});

describe('AlertsComponent type filter', () => {
  let fixture: ComponentFixture<AlertsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const answers = [alertDto({ id: 1 }), alertDto({ id: 2, severity: 'MEDIUM' })];
  const missed = [missedAlert({ id: 3, severity: 'HIGH' }), missedAlert({ id: 4, missedDate: '2026-10-12' }), missedAlert({ id: 5, missedDate: '2026-10-11' })];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [AlertsComponent, AlertTableComponent, ...SHARED_DECLARATIONS],
      providers: [providePermissions('NURSE'), { provide: AlertCountService, useValue: { refresh: jasmine.createSpy('refresh') } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlertsComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne(r => r.url === `${environment.apiUrl}/alerts`).flush([...answers, ...missed]);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const typeBtn = (t: string) => el.querySelector<HTMLButtonElement>(`[data-type=${t}]`)!;
  const rows = () => Array.from(el.querySelectorAll('.alert-row'));
  const sev = (s: string) => el.querySelector<HTMLButtonElement>(`[data-severity=${s}]`)!;

  it('offers All / Answers / Missed check-ins with counts, All selected', () => {
    expect(Array.from(el.querySelectorAll('[aria-label="Filter alerts by type"] .pill-group__item')).map(b => b.getAttribute('aria-label'))).toEqual(
      ['All types, 5', 'Answers, 2', 'Missed check-ins, 3']);
    expect(typeBtn('all').getAttribute('aria-pressed')).toBe('true');
    expect(rows().length).toBe(5);
  });

  it('Answers shows only the answer alerts, client-side (no new request)', () => {
    typeBtn('answers').click();
    fixture.detectChanges();
    expect(rows().length).toBe(2);
    expect(rows().every(r => !r.textContent!.includes('Missed check-in'))).toBeTrue();
    expect(typeBtn('answers').getAttribute('aria-pressed')).toBe('true');
    expect(typeBtn('all').getAttribute('aria-pressed')).toBe('false');
    http.expectNone(r => r.url === `${environment.apiUrl}/alerts`);
  });

  it('Missed check-ins shows only those, and the severity counts follow the type', () => {
    typeBtn('missed').click();
    fixture.detectChanges();
    expect(rows().length).toBe(3);
    expect(rows().every(r => r.textContent!.includes('Missed check-in'))).toBeTrue();
    expect(sev('HIGH').getAttribute('aria-label')).toBe('High, 1');
    expect(sev('MEDIUM').getAttribute('aria-label')).toBe('Medium, 2');
    sev('HIGH').click();
    fixture.detectChanges();
    expect(rows().length).toBe(1);
  });

  it('switching to Resolved resets the type filter', () => {
    typeBtn('missed').click();
    fixture.detectChanges();
    (el.querySelector('#filter-resolved') as HTMLButtonElement).click();
    http.expectOne(r => r.url === `${environment.apiUrl}/alerts`).flush([]);
    fixture.detectChanges();
    expect(typeBtn('all').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows "No alerts match this filter." when the chosen type has none', () => {
    (fixture.componentInstance as AlertsComponent).alerts = answers;
    typeBtn('missed').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('No alerts match this filter.');
  });
});
