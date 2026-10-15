import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy } from '@angular/core';
import { WbCategory, WbModel, WbSeries, computeWeekBars } from './week-bars.geometry';

let nextId = 0;

/** Grouped weekly bars in the same visual style as the trend chart (variant "full"). */
@Component({
  selector: 'app-week-bars',
  templateUrl: './week-bars.component.html',
  styles: [':host { display: block; }']
})
export class WeekBarsComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() categories: WbCategory[] = [];
  @Input() series: WbSeries[] = [];
  @Input() unit = '';
  @Input() max: number | 'auto' = 'auto';
  @Input() title = '';

  readonly uid = ++nextId;
  readonly titleId = `wb-title-${this.uid}`;
  readonly descId = `wb-desc-${this.uid}`;
  readonly hatchId = `wb${this.uid}-hatch`;
  readonly greyId = `wb${this.uid}-grey`;
  readonly critId = `wb${this.uid}-crit`;
  readonly warnId = `wb${this.uid}-warn`;
  width = 560;
  model!: WbModel;
  private ro?: ResizeObserver;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {
    this.recompute();
  }

  ngOnChanges(): void {
    this.recompute();
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.ro = new ResizeObserver(() => this.zone.run(() => {
      const w = Math.round(this.host.nativeElement.clientWidth);
      if (w > 0 && w !== this.width) {
        this.width = w;
        this.recompute();
      }
    }));
    this.ro.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  fill(tone: string, miss: boolean): string {
    return `url(#${miss ? this.greyId : tone === 'critical' ? this.critId : tone === 'warning' ? this.warnId : this.hatchId})`;
  }

  private recompute(): void {
    this.model = computeWeekBars({ categories: this.categories, series: this.series, unit: this.unit, max: this.max, title: this.title }, this.width);
  }
}
