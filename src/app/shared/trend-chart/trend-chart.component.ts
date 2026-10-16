import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { SeriesPoint } from '../care.model';
import { chartTextFor } from '../chart-text';
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
  /** Already translated; defaults to "Pain". */
  @Input() label: string | null = null;
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

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone, private i18n: I18nService) {
    this.recompute();
  }

  get labelText(): string {
    return this.label ?? this.i18n.t('chart.pain');
  }

  /** The threshold with its unit, formatted for the legend. */
  get thresholdText(): string {
    return this.threshold === null ? '' : chartTextFor(this.i18n).value(this.threshold, this.unit);
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
      points: this.points ?? [], totalDays: this.totalDays, threshold: this.threshold, label: this.labelText,
      unit: this.unit, domain: this.domain, variant: this.kind, todayDay: this.todayDay, nowDay: this.nowDay
    }, this.width, chartTextFor(this.i18n));
  }

  show(d: DayModel): void {
    this.active = d;
    this.tipLeft = Math.min(Math.max(d.tip.x, 72), Math.max(this.model.w - 72, 72));
  }

  hide(): void {
    this.active = null;
  }
}
