import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { alertDto } from '../../testing/fixtures';
import { AlertTableComponent } from './alert-table.component';

describe('AlertTableComponent', () => {
  let fixture: ComponentFixture<AlertTableComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let changed: jasmine.Spy;
  const api = environment.apiUrl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [AlertTableComponent]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlertTableComponent);
    el = fixture.nativeElement;
    changed = jasmine.createSpy('changed');
    fixture.componentInstance.changed.subscribe(changed);
  });

  afterEach(() => http.verify());

  function show(alerts = [alertDto()], showPatient = true) {
    fixture.componentRef.setInput('alerts', alerts);
    fixture.componentRef.setInput('showPatient', showPatient);
    fixture.detectChanges();
  }

  it('renders the columns, patient link (inbox only) and Yes/No answers', () => {
    show([alertDto({ answerValue: 'true' }), alertDto({ id: 2, answerValue: 'false', status: 'ACKNOWLEDGED' })]);
    const headers = Array.from(el.querySelectorAll('th')).map(h => h.textContent!.trim());
    expect(headers).toEqual(['Severity', 'Patient', 'Question', 'Answer', 'Message', 'Created', 'Status', 'Actions']);
    const rows = el.querySelectorAll('tbody tr');
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('/patients/5');
    expect(rows[0].textContent).toContain('Yes');
    expect(rows[1].textContent).toContain('No');
    expect(rows[0].textContent).toContain('Pain level?');
  });

  it('hides the Patient column when showPatient is false', () => {
    show([alertDto()], false);
    expect(Array.from(el.querySelectorAll('th')).map(h => h.textContent!.trim())).not.toContain('Patient');
  });

  it('shows Acknowledge only for OPEN alerts and Resolve unless RESOLVED', () => {
    show([alertDto({ id: 1, status: 'OPEN' }), alertDto({ id: 2, status: 'ACKNOWLEDGED' }), alertDto({ id: 3, status: 'RESOLVED' })]);
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows[0].querySelector('.btn-ack')).not.toBeNull();
    expect(rows[0].querySelector('.btn-resolve')).not.toBeNull();
    expect(rows[1].querySelector('.btn-ack')).toBeNull();
    expect(rows[1].querySelector('.btn-resolve')).not.toBeNull();
    expect(rows[2].querySelector('.btn-ack')).toBeNull();
    expect(rows[2].querySelector('.btn-resolve')).toBeNull();
  });

  it('acknowledge POSTs and emits changed', () => {
    show();
    (el.querySelector('.btn-ack') as HTMLButtonElement).click();
    const req = http.expectOne(`${api}/alerts/1/acknowledge`);
    expect(req.request.method).toBe('POST');
    req.flush(alertDto({ status: 'ACKNOWLEDGED' }));
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('resolve requires a non-blank note, then POSTs it and emits changed', async () => {
    show();
    (el.querySelector('.btn-resolve') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const confirm = el.querySelector('.btn-confirm') as HTMLButtonElement;
    const ta = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('maxlength')).toBe('1000');
    expect(confirm.disabled).toBeTrue();

    ta.value = '   ';
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirm.disabled).toBeTrue();

    ta.value = 'Called the patient';
    ta.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirm.disabled).toBeFalse();
    confirm.click();
    const req = http.expectOne(`${api}/alerts/1/resolve`);
    expect(req.request.body).toEqual({ note: 'Called the patient' });
    req.flush(alertDto({ status: 'RESOLVED' }));
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('on 409 shows the message and emits changed', () => {
    show();
    (el.querySelector('.btn-ack') as HTMLButtonElement).click();
    http.expectOne(`${api}/alerts/1/acknowledge`).flush({ error: 'INVALID_STATE' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el.textContent).toContain('This alert was updated by someone else. Reloading.');
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
