import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { HeaderComponent } from '../../shared/header/header.component';
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
      declarations: [AlertsComponent, AlertTableComponent, HeaderComponent]
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
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('shows the empty state', () => {
    fixture.detectChanges();
    alertsReq().flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No open alerts.');
  });

  it('"Show resolved" requests status=RESOLVED', () => {
    fixture.detectChanges();
    alertsReq().flush([]);
    const box = el.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    const req = alertsReq();
    expect(req.request.params.getAll('status')).toEqual(['RESOLVED']);
    req.flush([alertDto({ status: 'RESOLVED' })]);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
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
});
