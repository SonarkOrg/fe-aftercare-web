import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AppointmentMetrics } from '../../models/appointment.model';
import { AppointmentBadgeComponent } from '../../shared/appointment-badge/appointment-badge.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { appointment } from '../../testing/fixtures';
import { AppointmentsComponent } from './appointments.component';

describe('AppointmentsComponent', () => {
  let fixture: ComponentFixture<AppointmentsComponent>;
  let component: AppointmentsComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const api = `${environment.apiUrl}/appointments`;

  const metrics = (over: Partial<AppointmentMetrics> = {}): AppointmentMetrics => ({
    from: '2026-10-14', to: '2026-10-14', total: 3, scheduled: 1, ready: 1, needsReview: 1, cancelled: 1, completed: 0,
    noShow: 1, questionnairesCompleted: 2, questionnaireMissing: 1, completionRate: 0.6667, ...over
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [AppointmentsComponent, AppointmentBadgeComponent, HeaderComponent]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppointmentsComponent);
    component = fixture.componentInstance;
    component.date = '2026-10-14'; // a Wednesday
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  function flush(from: string, to: string, list: any[] = [], m: Partial<AppointmentMetrics> = {}) {
    const l = http.expectOne(r => r.url === api);
    expect(l.request.params.get('from')).toBe(from);
    expect(l.request.params.get('to')).toBe(to);
    const mr = http.expectOne(r => r.url === `${api}/metrics`);
    expect(mr.request.params.get('from')).toBe(from);
    expect(mr.request.params.get('to')).toBe(to);
    l.flush(list);
    mr.flush(metrics({ from, to, ...m }));
    fixture.detectChanges();
  }

  const click = (id: string) => { (el.querySelector('#' + id) as HTMLButtonElement).click(); };

  it('loads the day range by default', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    expect(el.querySelector('#view-day')!.classList).toContain('selected');
  });

  it('week view runs Monday to Sunday', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    click('view-week');
    flush('2026-10-12', '2026-10-18');
  });

  it('Previous/Next move by 1 day in day view and 7 days in week view', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    click('next');
    flush('2026-10-15', '2026-10-15');
    click('prev');
    click('prev');
    // the first prev was superseded by the second: only the latest pair is live
    const lists = http.match(r => r.url === api).filter(r => !r.cancelled);
    const mets = http.match(r => r.url === `${api}/metrics`).filter(r => !r.cancelled);
    expect(lists.map(r => r.request.params.get('from'))).toEqual(['2026-10-13']);
    lists.forEach(r => r.flush([]));
    mets.forEach(r => r.flush(metrics()));
    click('view-week');
    flush('2026-10-12', '2026-10-18'); // 2026-10-13 is still in the week of Oct 12
    click('next');
    flush('2026-10-19', '2026-10-25');
  });

  it('cancels a superseded load so only the latest day is rendered', () => {
    fixture.detectChanges();
    const a = { list: http.expectOne(r => r.url === api), met: http.expectOne(r => r.url === `${api}/metrics`) };
    click('next');
    const b = { list: http.expectOne(r => r.url === api && r.params.get('from') === '2026-10-15'),
      met: http.expectOne(r => r.url === `${api}/metrics` && r.params.get('from') === '2026-10-15') };
    expect(a.list.cancelled).toBeTrue();
    expect(a.met.cancelled).toBeTrue();
    b.list.flush([appointment({ id: 7, scheduledAt: '2026-10-15T09:00:00' })]);
    b.met.flush(metrics({ total: 9 }));
    fixture.detectChanges();
    expect(component.count).toBe(1);
    expect(component.metrics!.total).toBe(9);
    expect(Array.from(el.querySelectorAll('.day-group h3')).map(h => h.textContent)).toEqual(['2026-10-15']);
  });

  it('clears groups and metrics when a load fails', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00' })]);
    expect(component.groups.length).toBe(1);
    click('next');
    http.expectOne(r => r.url === api).flush({}, { status: 500, statusText: 'Server Error' });
    http.match(r => r.url === `${api}/metrics`);
    fixture.detectChanges();
    expect(component.groups).toEqual([]);
    expect(component.metrics).toBeNull();
    expect(component.errorMessage).toBeTruthy();
  });

  it('renders the metrics card: 67% for 0.6667 and a dash for null', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    const card = el.querySelector('.metrics')!.textContent!;
    expect(card).toContain('67%');
    expect(card).toContain('Appointments');
    expect(card).toContain('Questionnaires completed');
    expect(card).toContain('Needs review');
    expect(card).toContain('Questionnaire missing');
    expect(card).toContain('Cancelled / no-show');
    const values = Array.from(el.querySelectorAll('.metric-value')).map(v => v.textContent);
    expect(values).toEqual(['3', '67%', '1', '1', '2']);

    click('next');
    flush('2026-10-15', '2026-10-15', [], { completionRate: null });
    expect(el.querySelectorAll('.metric-value')[1].textContent).toBe('—');
  });

  it('groups appointments by date and renders time, patient, type, clinician, location and badge', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [
      appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00', status: 'NEEDS_REVIEW' }),
      appointment({ id: 2, scheduledAt: '2026-10-14T11:00:00', status: 'SCHEDULED', questionnaireMissing: true }),
      appointment({ id: 3, scheduledAt: '2026-10-15T09:00:00', status: 'COMPLETED' })
    ]);
    expect(Array.from(el.querySelectorAll('.day-group h3')).map(h => h.textContent)).toEqual(['2026-10-14', '2026-10-15']);
    const first = el.querySelector('.appt-list li')!;
    expect(first.querySelector('.time')!.textContent).toBe('08:30');
    expect(first.textContent).toContain('30 min');
    expect(first.textContent).toContain('Jane Doe');
    expect(first.textContent).toContain('Pre op consult');
    expect(first.textContent).toContain('Dr. Roy');
    expect(first.textContent).toContain('Clinic A');
    expect(first.querySelector('a')!.getAttribute('href')).toBe('/appointments/1');
    expect(Array.from(el.querySelectorAll('.badge')).map(b => b.textContent)).toEqual(['Needs review', 'Questionnaire missing', 'Completed']);
    expect(el.textContent).not.toContain('No appointments.');
  });

  it('shows the empty state', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    expect(el.textContent).toContain('No appointments.');
  });

  it('links to the new appointment form', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    const link = Array.from(el.querySelectorAll('a')).find(a => a.textContent!.includes('New appointment'))!;
    expect(link.getAttribute('href')).toBe('/appointments/new');
  });
});
