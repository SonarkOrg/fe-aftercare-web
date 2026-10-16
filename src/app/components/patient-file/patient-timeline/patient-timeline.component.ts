import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TimelineService } from '../../../Services/Timeline.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { timelineSummary } from '../../../i18n/content';
import { I18nService } from '../../../i18n/i18n.service';
import { TKey } from '../../../i18n/i18n.types';
import { apiErrorOf } from '../../../models/api-error.model';
import { CareNote, TimelineCategory, TimelineItem } from '../../../models/timeline.model';
import { DayGroup, fmtDayShort, fmtTime, groupByDay } from '../../../shared/messages.util';
import { TimelineTone, timelineTone } from '../../../shared/status';

export const NOTE_MAX = 5000;
export const PAGE_SIZE = 30;

export const TIMELINE_FILTERS: { label: TKey; category: TimelineCategory | null }[] = [
  { label: 'pf.timeline.filter.all', category: null }, { label: 'enum.timelineCategory.NOTE', category: 'NOTE' }, { label: 'enum.timelineCategory.CHECK_IN', category: 'CHECK_IN' },
  { label: 'enum.timelineCategory.ALERT', category: 'ALERT' }, { label: 'enum.timelineCategory.APPOINTMENT', category: 'APPOINTMENT' }, { label: 'enum.timelineCategory.FOLLOW_UP', category: 'FOLLOW_UP' },
  { label: 'enum.timelineCategory.DOCUMENT', category: 'DOCUMENT' }, { label: 'enum.timelineCategory.MESSAGE', category: 'MESSAGE' }
];

@Component({
  selector: 'app-patient-timeline',
  templateUrl: './patient-timeline.component.html'
})
export class PatientTimelineComponent implements OnInit {
  @Input() patientId = 0;
  /** Asks the patient file to open another of its tabs (alerts, documents). */
  @Output() openTab = new EventEmitter<'alerts' | 'documents'>();

  readonly filters = TIMELINE_FILTERS;
  readonly max = NOTE_MAX;
  filter: TimelineCategory | null = null;
  items: TimelineItem[] = [];
  groups: DayGroup<TimelineItem>[] = [];
  page = 0;
  hasMore = false;
  loading = true;
  loadError = false;
  moreError = false;

  /* composer */
  body = '';
  notedAt = '';
  saving = false;
  composeError: string | null = null;

  /* note actions */
  expanded = new Set<number>();
  editing: { id: number; body: string } | null = null;
  editError: string | null = null;
  deleting: number | null = null;
  deleteBusy = false;

  constructor(private timeline: TimelineService, public i18n: I18nService, private errors: ApiErrorsService) {}

  summary(i: TimelineItem) {
    return timelineSummary(i, this.i18n.lang);
  }

  editableUntil(n: CareNote): string {
    return this.time(n.editableUntil);
  }

  ngOnInit(): void {
    this.load(0);
  }

  tone(i: TimelineItem): TimelineTone {
    return timelineTone(i);
  }

  time(iso: string): string {
    return fmtTime(iso, this.i18n.lang);
  }

  day(iso: string): string {
    return fmtDayShort(iso, this.i18n.lang);
  }

  actor(i: TimelineItem): string {
    return i.actorName ?? i.note?.authorName ?? this.i18n.t(i.actorType === 'PATIENT' ? 'common.patient' : 'alert.bySystem');
  }

  setFilter(c: TimelineCategory | null): void {
    if (c === this.filter) {
      return;
    }
    this.filter = c;
    this.load(0);
  }

  load(page: number): void {
    const append = page > 0;
    if (append) {
      this.moreError = false;
    } else {
      this.loading = true;
      this.loadError = false;
    }
    this.timeline.timeline(this.patientId, this.filter ? [this.filter] : [], page, PAGE_SIZE).subscribe({
      next: p => {
        this.items = append ? [...this.items, ...p.items] : p.items;
        this.page = p.page;
        this.hasMore = p.hasMore;
        this.loading = false;
        this.regroup();
      },
      error: () => {
        this.loading = false;
        if (append) {
          this.moreError = true;
        } else {
          this.loadError = true;
        }
      }
    });
  }

  private regroup(): void {
    this.groups = groupByDay(this.items, this.i18n.lang, i => i.occurredAt);
  }

  /* ---------- composer ---------- */

  get canSave(): boolean {
    const n = this.body.trim().length;
    return n > 0 && n <= NOTE_MAX && !this.saving;
  }

  saveNote(): void {
    if (!this.canSave) {
      return;
    }
    this.saving = true;
    this.composeError = null;
    const at = this.notedAt ? new Date(this.notedAt) : null;
    this.timeline.addNote(this.patientId, { body: this.body.trim(), notedAt: at && !isNaN(at.getTime()) ? at.toISOString() : null }).subscribe({
      next: () => {
        this.saving = false;
        this.body = '';
        this.notedAt = '';
        this.load(0);
      },
      error: err => {
        this.saving = false;
        const f = apiErrorOf(err)?.fieldErrors ?? {};
        this.composeError = f['notedAt'] ? this.errors.fieldText('notedAt', f['notedAt']) : f['body'] ? this.errors.fieldText('body', f['body']) : this.errors.text(err, 'pf.timeline.error.save');
      }
    });
  }

  /* ---------- note actions ---------- */

  canEdit(n: CareNote): boolean {
    return n.editableByMe && Date.now() < Date.parse(n.editableUntil);
  }

  long(n: CareNote): boolean {
    const b = n.body ?? '';
    return b.length > 200 || b.split('\n').length > 3;
  }

  toggleMore(id: number): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
    } else {
      this.expanded.add(id);
    }
  }

  startEdit(n: CareNote): void {
    this.deleting = null;
    this.editError = null;
    this.editing = { id: n.id, body: n.body ?? '' };
  }

  saveEdit(): void {
    const e = this.editing;
    if (!e || !e.body.trim()) {
      return;
    }
    this.timeline.editNote(e.id, e.body.trim()).subscribe({
      next: n => {
        this.replaceNote(n);
        this.editing = null;
      },
      error: err => {
        const api = apiErrorOf(err);
        this.editError = this.errors.text(err, 'pf.timeline.error.edit');
        if (api?.error === 'EDIT_WINDOW_CLOSED') {
          this.load(0);
        }
      }
    });
  }

  startDelete(n: CareNote): void {
    this.editing = null;
    this.deleting = n.id;
  }

  confirmDelete(n: CareNote, reason: string): void {
    this.deleteBusy = true;
    this.timeline.deleteNote(n.id, reason).subscribe({
      next: d => {
        this.deleteBusy = false;
        this.deleting = null;
        this.replaceNote(d);
      },
      error: err => {
        this.deleteBusy = false;
        this.editError = this.errors.text(err, 'pf.timeline.error.delete');
      }
    });
  }

  private replaceNote(n: CareNote): void {
    this.items = this.items.map(i => (i.note && i.note.id === n.id ? { ...i, note: n } : i));
    this.regroup();
  }
}
