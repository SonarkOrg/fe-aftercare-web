import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { SeriesPoint } from '../care.model';
import { TrendChartComponent } from './trend-chart.component';

describe('TrendChartComponent', () => {
  let fixture: ComponentFixture<TrendChartComponent>;
  let el: HTMLElement;

  const points: SeriesPoint[] = [
    { day: 1, date: '2026-10-11', value: 3 }, { day: 2, date: '2026-10-12', value: 8 }, { day: 4, date: '2026-10-14', value: 4 }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommonModule], declarations: [TrendChartComponent] }).compileComponents();
    fixture = TestBed.createComponent(TrendChartComponent);
    el = fixture.nativeElement;
  });

  function render(inputs: Record<string, unknown>) {
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
  }

  it('renders a bar per recorded day, a red pill per alert day and a stub per missed day', () => {
    render({ points: [...points, { day: 5, date: '2026-10-15', value: 7 }], threshold: 7, totalDays: 7, todayDay: 5 });
    expect(el.querySelectorAll('g.bar').length).toBe(5); // days 1-5, day 3 is a missed stub
    expect(el.querySelectorAll('.bc-bar--alert').length).toBe(2);
    expect(el.querySelectorAll('.bc-pill--alert').length).toBe(2);
    expect(el.querySelectorAll('.bc-bar--miss').length).toBe(1);
    expect(el.querySelector('.bc-pill--dash')).not.toBeNull();
    expect(el.querySelectorAll('path').length).toBe(0); // no line is ever drawn between days
  });

  it('draws the dashed limit line and the "Alert ≥ 7" pill', () => {
    render({ points, threshold: 7, totalDays: 7 });
    expect(el.querySelector('line.bc-limit')).not.toBeNull();
    expect(el.querySelector('.bc-limit-t')!.textContent).toBe('Alert ≥ 7');
    expect(el.querySelector('rect.bc-limit-pill')).not.toBeNull();
  });

  it('threshold known-none says "No alert rule"; loading and failed are distinguished', () => {
    render({ points, threshold: null, totalDays: 7 });
    expect(el.querySelector('line.bc-limit')).toBeNull();
    expect(el.querySelector('.bc-bar--alert')).toBeNull();
    expect(el.querySelector('.trend__caption')!.textContent).toContain('No alert rule for this measure.');
    render({ thresholdState: 'loading' });
    expect(el.querySelector('.trend__caption')!.textContent).toContain('Loading alert threshold');
    expect(el.querySelector('.trend__caption')!.textContent).not.toContain('No alert rule');
    render({ thresholdState: 'failed' });
    expect(el.querySelector('.trend__caption')!.textContent).toContain('Alert threshold unavailable');
    expect(el.querySelector('.trend__caption')!.textContent).not.toContain('No alert rule');
  });

  it('has <title>, <desc> and a visually hidden table with a row per day incl. "No check-in"', () => {
    render({ points, threshold: 7, totalDays: 7, todayDay: 4 });
    expect(el.querySelector('svg > title')!.textContent).toBe('Pain by follow-up day');
    expect(el.querySelector('svg > desc')!.textContent).toContain('3 check-ins over 7 days');
    expect(el.querySelector('svg')!.getAttribute('aria-labelledby')!.split(' ').length).toBe(2);
    const rows = Array.from(el.querySelectorAll('table.sr-only tbody tr')).map(r => r.textContent);
    expect(rows.length).toBe(4);
    expect(rows.some(r => r!.includes('No check-in'))).toBeTrue();
  });

  it('every bar is focusable and owns a focus ring rect; focusing shows the tooltip', () => {
    render({ points, threshold: 7, totalDays: 7, todayDay: 4 });
    const bars = Array.from(el.querySelectorAll('g.bar'));
    expect(bars.every(b => b.getAttribute('tabindex') === '0' && b.querySelector('rect.bar__focus') !== null)).toBeTrue();
    const bar = bars[1] as SVGGElement;
    expect(bar.getAttribute('aria-label')).toBe('Day 2, 2026-10-12: 8, at or above alert threshold');
    bar.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    const tip = el.querySelector('.chart-tip')!;
    expect(tip.textContent).toContain('Day 2 · Mon 12 Oct');
    expect(tip.textContent).toContain('8');
    expect(tip.textContent).toContain('At or above alert');
    bar.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('.chart-tip')).toBeNull();
  });

  it('pattern and gradient ids are unique per instance', () => {
    render({ points, threshold: 7, totalDays: 7 });
    const other = TestBed.createComponent(TrendChartComponent);
    other.detectChanges();
    const ids = (e: HTMLElement) => Array.from(e.querySelectorAll('defs [id]')).map(n => n.id);
    expect(ids(el).length).toBe(3);
    expect(ids(el).some(i => ids(other.nativeElement).includes(i))).toBeFalse();
  });

  it('compact (and the old "spark" name) is a single labelled image without tab stops', () => {
    render({ points, threshold: 7, totalDays: 7, variant: 'spark' });
    expect(el.querySelector('svg')!.getAttribute('aria-label')).toContain('Latest 4');
    expect(el.querySelector('[tabindex]')).toBeNull();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.bc-limit-t')!.textContent).toBe('≥7');
  });
});
