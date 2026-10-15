import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AlertCountService } from '../../Services/AlertCount.service';
import { alertDto } from '../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
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
      declarations: [AlertTableComponent, ...SHARED_DECLARATIONS],
      providers: [{ provide: AlertCountService, useValue: { refresh: jasmine.createSpy('refresh') } }]
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

  it('renders one row per alert: severity + status chips (glyph and word), patient link (inbox only), question, Yes/No answers', () => {
    show([alertDto({ answerValue: 'true' }), alertDto({ id: 2, answerValue: 'false', status: 'ACKNOWLEDGED' })]);
    const rows = el.querySelectorAll('.alert-row');
    expect(rows.length).toBe(2);
    expect(el.querySelector('table')).toBeNull();
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('/patients/5');
    expect(rows[0].textContent).toContain('Jane Doe');
    expect(rows[0].textContent).toContain('Answer Yes');
    expect(rows[1].textContent).toContain('Answer No');
    expect(rows[0].textContent).toContain('Pain level?');
    expect(Array.from(rows[0].querySelectorAll('.chip__label')).map(c => c.textContent)).toEqual(['High', 'Open']);
    expect(Array.from(rows[0].querySelectorAll('.chip__glyph')).every(g => g.getAttribute('aria-hidden') === 'true')).toBeTrue();
  });

  it('hides the patient name when showPatient is false', () => {
    show([alertDto()], false);
    expect(el.querySelector('.alert-row a')).toBeNull();
    expect(el.querySelector('.alert-row')!.textContent).not.toContain('Jane Doe');
  });

  it('shows Acknowledge only for OPEN alerts and Resolve unless RESOLVED', () => {
    show([alertDto({ id: 1, status: 'OPEN' }), alertDto({ id: 2, status: 'ACKNOWLEDGED' }), alertDto({ id: 3, status: 'RESOLVED' })]);
    const rows = Array.from(el.querySelectorAll('.alert-row'));
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
    expect(TestBed.inject(AlertCountService).refresh).toHaveBeenCalled();
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
