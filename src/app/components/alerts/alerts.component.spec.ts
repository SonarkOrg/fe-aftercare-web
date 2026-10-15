import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AlertCountService } from '../../Services/AlertCount.service';
import { alertDto } from '../../testing/fixtures';
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
      providers: [{ provide: AlertCountService, useValue: { refresh: jasmine.createSpy('refresh') } }]
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
    http.expectOne(`${url}/1/acknowledge`).flush(alertDto({ status: 'ACKNOWLEDGED' }));
    alertsReq().flush([]);
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
