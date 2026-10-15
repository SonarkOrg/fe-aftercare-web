import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { AppointmentMetrics } from '../../models/appointment.model';
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
      declarations: [AppointmentsComponent, ...SHARED_DECLARATIONS]
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
    expect(el.querySelector('#view-day')!.getAttribute('aria-pressed')).toBe('true');
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
    expect(Array.from(el.querySelectorAll('.board-group h3')).map(h => h.textContent!.trim())).toEqual(['Scheduled · awaiting questionnaire 1']);
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

  it('renders the KPI strip: 67% for 0.6667 and a dash for null', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    const card = el.querySelector('.metrics')!.textContent!;
    expect(card).toContain('Questionnaires completed');
    expect(card).toContain('Needs review');
    expect(card).toContain('Questionnaire missing');
    expect(card).toContain('Cancelled / no-show');
    expect(card).toContain('2 of 2 before the visit');
    expect(card).toContain('1 cancelled · 1 no-show');
    const values = Array.from(el.querySelectorAll('.tile__value')).map(v => v.textContent!.replace(/\s+/g, ' ').trim());
    expect(values).toEqual(['67%', '1 / 3', '1 / 3', '2 / 3']);
    expect(Array.from(el.querySelectorAll('.tile__label')).map(l => l.textContent!.trim())[0]).toBe('Questionnaires completed');
    expect(el.querySelector('.metrics .card__title')!.textContent).toBe('Today');
    expect(el.querySelector('.helper-line')!.textContent).toContain('roughly 10 minutes');
    expect(el.querySelector('.helper-line')!.textContent).toContain('estimate: 5 min each');

    click('next');
    flush('2026-10-15', '2026-10-15', [], { completionRate: null, questionnairesCompleted: 0 });
    expect(el.querySelectorAll('.tile__value')[0].textContent!.trim()).toBe('—');
    expect(el.querySelector('.helper-line')!.textContent).toContain('No questionnaires completed ahead of time');
  });

  it('day view: readiness board groups, order, chips and a collapsed closed group', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [
      appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00', status: 'NEEDS_REVIEW', flagCount: 2 }),
      appointment({ id: 2, scheduledAt: '2026-10-14T11:00:00', status: 'SCHEDULED', questionnaireMissing: true }),
      appointment({ id: 3, scheduledAt: '2026-10-14T09:00:00', status: 'COMPLETED' })
    ]);
    expect(Array.from(el.querySelectorAll('.board-group h3')).map(h => h.textContent!.trim()))
      .toEqual(['Needs review 1', 'Questionnaire missing 1']);
    const closed = el.querySelector('details.board-closed') as HTMLDetailsElement;
    expect(closed.open).toBeFalse();
    expect(closed.querySelector('summary')!.textContent).toContain('Completed, cancelled & no-show');
    expect(closed.querySelector('summary .badge')!.textContent).toBe('1');
    const first = el.querySelector('.appt-card')!;
    expect(first.textContent).toContain('08:30–09:00');
    expect(first.textContent).toContain('Jane Doe');
    expect(first.textContent).toContain('Pre op consult');
    expect(first.textContent).toContain('Dr. Roy');
    expect(first.textContent).toContain('Clinic A');
    expect(first.textContent).toContain('2 flag(s)');
    expect(first.querySelector('a')!.getAttribute('href')).toBe('/appointments/1');
    expect(Array.from(el.querySelectorAll('.appt-card .chip__label')).map(b => b.textContent))
      .toContain('Needs review');
    expect(el.textContent).not.toContain('No appointments.');
  });

  it('Mark reviewed posts and reloads', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14', [appointment({ id: 1, status: 'NEEDS_REVIEW' })]);
    (el.querySelector('.btn-reviewed') as HTMLButtonElement).click();
    http.expectOne(`${api}/1/review`).flush(appointment({ id: 1, status: 'READY' }));
    flush('2026-10-14', '2026-10-14', [appointment({ id: 1, status: 'READY' })]);
    expect(el.querySelector('[data-group=ready]')).not.toBeNull();
  });

  it('week view renders 7 day columns and positions blocks', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    click('view-week');
    flush('2026-10-12', '2026-10-18', [appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00', status: 'NEEDS_REVIEW' })]);
    expect(el.querySelectorAll('.week-day').length).toBe(7);
    const block = el.querySelector('.week-block') as HTMLElement;
    expect(block.style.top).toBe('144px');
    expect(block.style.height).toBe('48px');
    expect(block.textContent).toContain('Needs review');
    expect(block.textContent).toContain('08:30');
    expect(block.textContent).toContain('Jane Doe');
    expect(block.querySelector('.week-block__glyph')!.textContent).toBe('◆');
    expect(block.getAttribute('href')).toBe('/appointments/1');
    expect(el.textContent).toContain('Oct 12 – Oct 18, 2026');
  });

  it('week view: back-to-back 15-minute blocks sit in separate lanes and none is shorter than 44px', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    click('view-week');
    flush('2026-10-12', '2026-10-18', [
      appointment({ id: 1, scheduledAt: '2026-10-14T09:00:00', durationMinutes: 15 }),
      appointment({ id: 2, scheduledAt: '2026-10-14T09:15:00', durationMinutes: 15 })]);
    const blocks = Array.from(el.querySelectorAll('.week-block')) as HTMLElement[];
    expect(blocks.length).toBe(2);
    expect(blocks.every(b => parseFloat(b.style.height) >= 44)).toBeTrue();
    expect(blocks[0].style.left).not.toBe(blocks[1].style.left);
    expect(blocks[0].style.width).toBe('calc(50% - 2px)');
  });

  it('week view: the agenda uses human headings and today is a pill with screen-reader text', () => {
    fixture.detectChanges();
    flush('2026-10-14', '2026-10-14');
    click('view-week');
    flush('2026-10-12', '2026-10-18', [appointment({ id: 1, scheduledAt: '2026-10-14T08:30:00' })]);
    expect(el.querySelector('.agenda .card__title--sm')!.textContent).toContain('Wednesday 14 October');
    expect(el.querySelector('.hero__sub')!.textContent).toContain('Oct 12 – Oct 18, 2026');
    expect(el.querySelector('h1')!.textContent).toBe('Appointments');
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
