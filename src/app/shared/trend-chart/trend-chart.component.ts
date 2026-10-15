import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy } from '@angular/core';
import { SeriesPoint } from '../care.model';
import { BarModel, DayModel, Variant, computeBars } from './trend-chart.geometry';

let nextId = 0;

/** 'spark' is the old name of 'compact'. */
export type ChartVariant = Variant | 'spark';
export type ThresholdState = 'known' | 'loading' | 'failed';

@Component({
  selector: 'app-trend-chart',
  templateUrl: './trend-chart.component.html',
  styleUrl: './trend-chart.component.css'
})
export class TrendChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() points: SeriesPoint[] = [];
  @Input() totalDays = 7;
  @Input() threshold: number | null = null;
  /** Why `threshold` is null: still loading, failed to load, or genuinely no rule ('known'). */
  @Input() thresholdState: ThresholdState = 'known';
  @Input() label = 'Pain';
  @Input() unit = '';
  @Input() domain: [number, number] | 'auto' = [0, 10];
  @Input() variant: ChartVariant = 'full';
  @Input() todayDay: number | null = null;
  /** The real current day, when `todayDay` is held back for missed-day counting. */
  @Input() nowDay: number | null = null;

  readonly uid = ++nextId;
  readonly titleId = `chart-title-${this.uid}`;
  readonly descId = `chart-desc-${this.uid}`;
  readonly hatchId = `tc${this.uid}-hatch`;
  readonly greyId = `tc${this.uid}-grey`;
  readonly critId = `tc${this.uid}-crit`;
  width = 560;
  model!: BarModel;
  active: DayModel | null = null;
  tipLeft = 0;

  private ro?: ResizeObserver;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {
    this.recompute();
  }

  get kind(): Variant {
    return this.variant === 'spark' ? 'compact' : this.variant;
  }

  ngOnChanges(): void {
    this.recompute();
    this.active = null;
  }

  ngAfterViewInit(): void {
    if (this.kind === 'micro' || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.ro = new ResizeObserver(() => this.zone.run(() => this.measure()));
    this.ro.observe(this.host.nativeElement); // fires once asynchronously with the initial size
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private measure(): void {
    const w = this.host.nativeElement.clientWidth;
    if (w > 0 && Math.round(w) !== this.width) {
      this.width = Math.round(w);
      this.recompute();
    }
  }

  private recompute(): void {
    this.model = computeBars({
      points: this.points ?? [], totalDays: this.totalDays, threshold: this.threshold, label: this.label,
      unit: this.unit, domain: this.domain, variant: this.kind, todayDay: this.todayDay, nowDay: this.nowDay
    }, this.width);
  }

  show(d: DayModel): void {
    this.active = d;
    this.tipLeft = Math.min(Math.max(d.tip.x, 72), Math.max(this.model.w - 72, 72));
  }

  hide(): void {
    this.active = null;
  }
}
