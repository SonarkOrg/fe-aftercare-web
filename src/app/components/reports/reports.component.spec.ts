import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { addDays, businessToday } from '../../shared/link.util';
import { WeekBarsComponent } from '../../shared/week-bars/week-bars.component';
import { report } from '../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../testing/shared-declarations';
import { ReportsComponent } from './reports.component';

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let http: HttpTestingController;
  let navigate: jasmine.Spy;
  let el: HTMLElement;
  const today = businessToday();
  const url = `${environment.apiUrl}/reports/summary`;
  const summary = (from: string, to: string) => http.expectOne(r => r.url === url && r.params.get('from') === from && r.params.get('to') === to);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [ReportsComponent, WeekBarsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  /** ngModel connects its controls (and writes values / disabled) in a microtask: wait for it, then render. */
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  async function init(body = report()) {
    await settle();
    summary(addDays(today, -27), today).flush(body);
    await settle();
  }
  const pills = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.toolbar .pill-group__item'));
  const setDate = async (id: string, v: string) => {
    const i = q<HTMLInputElement>(id);
    i.value = v;
    i.dispatchEvent(new Event('input'));
    await settle();
  };

  it('loads the last 28 days by default, with skeletons while loading', async () => {
    await settle();
    expect(el.querySelector('.skeleton--tile')).not.toBeNull();
    expect(el.querySelector('.skeleton--kpi')).not.toBeNull();
    expect(el.querySelector('.skeleton--chart')).not.toBeNull();
    expect(q<HTMLButtonElement>('.export-csv').disabled).toBeTrue();
    summary(addDays(today, -27), today).flush(report());
    await settle();
    expect(el.querySelector('.skeleton--tile')).toBeNull();
    expect(q<HTMLButtonElement>('.export-csv').disabled).toBeFalse();
    expect(pills().map(p => p.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('has the title, the subtitle and the From/To inputs capped at today', async () => {
    await init();
    expect(q('h1').textContent).toBe('Reports');
    expect(q('.hero__sub').textContent).toBe('Follow-up, alert and appointment activity for a date range.');
    expect(q<HTMLInputElement>('#rep-from').max).toBe(today);
    expect(q<HTMLInputElement>('#rep-to').max).toBe(today);
    expect(q<HTMLInputElement>('#rep-from').value).toBe(addDays(today, -27));
  });

  it('presets set from/to, mirror them in the query params and reload: 7 days, 90 days, 12 months', async () => {
    await init();
    const cases: [number, number][] = [[0, 7], [2, 90], [3, 365]];
    for (const [i, days] of cases) {
      pills()[i].click();
      await settle();
      const from = addDays(today, -(days - 1));
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { from, to: today } }));
      summary(from, today).flush(report());
      await settle();
      expect(pills()[i].getAttribute('aria-pressed')).toBe('true');
      expect(q<HTMLInputElement>('#rep-from').value).toBe(from);
      expect(q<HTMLInputElement>('#rep-to').value).toBe(today);
    }
    expect(addDays(today, -364)).toBe(q<HTMLInputElement>('#rep-from').value); // 12 months = to - 364
  });

  it('Apply uses the typed dates', async () => {
    await init();
    await setDate('#rep-from', '2026-09-01');
    await setDate('#rep-to', '2026-09-30');
    q<HTMLButtonElement>('.apply-range').click();
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { from: '2026-09-01', to: '2026-09-30' } }));
    summary('2026-09-01', '2026-09-30').flush(report());
    await settle();
    expect(pills().every(p => p.getAttribute('aria-pressed') === 'false')).toBeTrue();
  });

  it('to before from shows an error and sends no request', async () => {
    await init();
    await setDate('#rep-from', '2026-09-30');
    await setDate('#rep-to', '2026-09-01');
    q<HTMLButtonElement>('.apply-range').click();
    await settle();
    http.expectNone(r => r.url === url);
    expect(q('.field-error').textContent).toBe('The end date must not be before the start date.');
  });

  it('a range over 366 days shows an error and sends no request; exactly 366 is allowed', async () => {
    await init();
    await setDate('#rep-from', '2025-01-01');
    await setDate('#rep-to', '2026-01-02'); // 367 days inclusive
    q<HTMLButtonElement>('.apply-range').click();
    await settle();
    http.expectNone(r => r.url === url);
    expect(q('.field-error').textContent).toBe('The range must not exceed 366 days.');
    await setDate('#rep-to', '2026-01-01'); // 366 days inclusive
    q<HTMLButtonElement>('.apply-range').click();
    await settle();
    summary('2025-01-01', '2026-01-01').flush(report());
    await settle();
    expect(el.querySelector('.field-error')).toBeNull();
  });

  it('maps the API 400s to the same messages', async () => {
    await init();
    q<HTMLButtonElement>('.apply-range').click();
    summary(addDays(today, -27), today).flush({ status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { to: 'range must not exceed 366 days' } }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('.field-error').textContent).toBe('The range must not exceed 366 days.');
  });

  it('shows the check-in tiles with percentages and "—" for a null rate', async () => {
    await init(report({ checkIns: { expected: 0, received: 0, completionRate: null, throughDate: '2026-10-14' } }));
    const tiles = Array.from(el.querySelectorAll('.card')[0].querySelectorAll('app-ring-tile .tile'));
    expect(tiles.map(t => t.querySelector('.tile__label')!.textContent!.replace(/\s+/g, ' ').trim())).toEqual(
      ['Check-in completion', 'Active follow-ups', 'Follow-ups started', 'Follow-ups closed']);
    expect(tiles[0].querySelector('.tile__value')!.textContent!.trim()).toBe('—');
    expect(tiles[0].querySelector('.tile__sub')!.textContent).toBe('0 of 0 · through 2026-10-14');
    expect(tiles[1].querySelector('.tile__value')!.textContent!.trim()).toBe('4');
    expect(tiles[2].querySelector('.tile__value')!.textContent!.trim()).toBe('6');
    expect(tiles[3].querySelector('.tile__value')!.textContent!.trim()).toBe('2');
  });

  it('count-only tiles draw no ring arc (a full circle would suggest 100 %); rate tiles do', async () => {
    await init();
    const checkIns = Array.from(el.querySelectorAll('.card')[0].querySelectorAll('app-ring-tile'));
    expect(checkIns[0].querySelector('.ring__arc')).not.toBeNull();
    for (const t of checkIns.slice(1)) {
      expect(t.querySelector('.ring__arc')).toBeNull();
    }
  });

  it('shows the completion percentage', async () => {
    await init();
    const first = el.querySelector('app-ring-tile .tile')!;
    expect(first.querySelector('.tile__value')!.textContent!.trim()).toBe('75 %');
    expect(first.querySelector('.tile__sub')!.textContent).toBe('15 of 20 · through 2026-10-14');
  });

  it('shows the alert KPIs: counts, means with "—" for none, and a critical chip with glyph and word', async () => {
    await init();
    const kpis = Array.from(el.querySelectorAll('.kpis .kpi'));
    const text = (i: number) => kpis[i].textContent!.replace(/\s+/g, ' ').trim();
    expect(text(0)).toContain('Alerts');
    expect(text(0)).toContain('7');
    expect(text(0)).toContain('3 high · 4 medium');
    expect(kpis[0].querySelector('.chip--critical .chip__glyph')!.textContent).toBe('▲');
    expect(kpis[0].querySelector('.chip--critical .chip__label')!.textContent).toBe('3 high');
    expect(text(1)).toContain('45 min');
    expect(text(1)).toContain('mean · 6 alerts');
    expect(text(2)).toContain('3 h 05');
    expect(text(2)).toContain('mean · 5 resolved');
    expect(text(3)).toContain('2');
    expect(text(3)).toContain('from this period');
  });

  it('shows "—" for means without data and no critical chip without high alerts', async () => {
    await init(report({ alerts: { total: 0, high: 0, medium: 0, responded: 0, meanMinutesToAcknowledge: null, resolved: 0, meanMinutesToResolve: null, unresolved: 0 } }));
    const kpis = Array.from(el.querySelectorAll('.kpis .kpi'));
    expect(kpis[1].querySelector('.kpi__value')!.textContent).toContain('—');
    expect(kpis[2].querySelector('.kpi__value')!.textContent).toContain('—');
    expect(el.querySelector('.kpis .chip--critical')).toBeNull();
  });

  it('shows the appointment tiles', async () => {
    await init();
    const cards = el.querySelectorAll('.card');
    const tiles = Array.from(cards[cards.length - 1].querySelectorAll('app-ring-tile .tile'));
    const val = (i: number) => tiles[i].querySelector('.tile__value')!.textContent!.trim();
    const sub = (i: number) => tiles[i].querySelector('.tile__sub')!.textContent;
    expect(val(0)).toBe('75 %');
    expect(sub(0)).toBe('6 of 8');
    expect(val(1)).toBe('33 %');
    expect(sub(1)).toBe('2 of 6 flagged');
    expect(val(2)).toBe('2 / 10');
    expect(val(3)).toBe('1');
    expect(sub(3)).toBe('of 6 past visits');
  });

  it('draws both weekly charts with accessible tables and legends with glyph and word', async () => {
    await init();
    const charts = el.querySelectorAll('app-week-bars');
    expect(charts.length).toBe(2);
    const alerts = charts[0];
    expect(alerts.querySelector('svg.bc')!.getAttribute('role')).toBe('img');
    expect(alerts.querySelector('svg title')!.textContent).toBe('Alerts per week');
    expect(alerts.querySelector('svg desc')!.textContent).toBe('Alerts per week, 18 Sep to 27 Sep: 1 high, 2 medium');
    expect(alerts.querySelector('.trend__legend')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('▲ High · ● Medium');
    const cells = (c: Element) => Array.from(c.querySelectorAll('table.sr-only tbody tr')).map(tr => Array.from(tr.children).map(x => x.textContent!.trim()));
    expect(cells(alerts)).toEqual([['18 Sep to 20 Sep', '1', '2'], ['21 Sep to 27 Sep', '0', '0']]);
    const completion = charts[1];
    expect(cells(completion)).toEqual([['18 Sep to 20 Sep', '75%'], ['21 Sep to 27 Sep', '–']]); // 0 expected: a dash, not 0 %
    expect(completion.querySelector('.bc-bar--miss')).not.toBeNull();
  });

  it('Export CSV hands the CSV and the filename to the downloader', async () => {
    await init();
    const save = jasmine.createSpy('save');
    component.save = save;
    q<HTMLButtonElement>('.export-csv').click();
    expect(save).toHaveBeenCalledTimes(1);
    const [name, text] = save.calls.mostRecent().args;
    expect(name).toBe('aftercare-report-2026-09-18-to-2026-10-15.csv');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"checkIns.expected","20"');
  });

  it('shows an error with Retry when the report fails', async () => {
    await settle();
    summary(addDays(today, -27), today).flush('x', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(q('.banner--error').textContent).toContain('Could not load the report.');
    expect(q<HTMLButtonElement>('.export-csv').disabled).toBeTrue();
    q<HTMLButtonElement>('.banner--error button').click();
    summary(addDays(today, -27), today).flush(report());
  });
});
