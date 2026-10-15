import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TimelineService } from '../../../Services/Timeline.service';
import { apiErrorOf } from '../../../models/api-error.model';
import { CareNote, TimelineCategory, TimelineItem } from '../../../models/timeline.model';
import { DayGroup, fmtDayShort, fmtTime, groupByDay } from '../../../shared/messages.util';
import { TimelineTone, timelineTone } from '../../../shared/status';

export const NOTE_MAX = 5000;
export const PAGE_SIZE = 30;

export const TIMELINE_FILTERS: { label: string; category: TimelineCategory | null }[] = [
  { label: 'All', category: null }, { label: 'Notes', category: 'NOTE' }, { label: 'Check-ins', category: 'CHECK_IN' },
  { label: 'Alerts', category: 'ALERT' }, { label: 'Appointments', category: 'APPOINTMENT' }, { label: 'Follow-up', category: 'FOLLOW_UP' },
  { label: 'Documents', category: 'DOCUMENT' }, { label: 'Messages', category: 'MESSAGE' }
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

  constructor(private timeline: TimelineService) {}

  ngOnInit(): void {
    this.load(0);
  }

  tone(i: TimelineItem): TimelineTone {
    return timelineTone(i);
  }

  time(iso: string): string {
    return fmtTime(iso, 'en');
  }

  day(iso: string): string {
    return fmtDayShort(iso);
  }

  actor(i: TimelineItem): string {
    return i.actorName ?? i.note?.authorName ?? (i.actorType === 'PATIENT' ? 'Patient' : 'System');
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
    this.groups = groupByDay(this.items, 'en', i => i.occurredAt);
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
        this.composeError = f['notedAt'] ?? f['body'] ?? 'Could not save the note.';
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
        this.editError = api?.error === 'EDIT_WINDOW_CLOSED' || api?.error === 'NOT_AUTHOR' ? api.message : 'Could not save the change.';
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
      error: () => {
        this.deleteBusy = false;
        this.editError = 'Could not mark the note as entered in error.';
      }
    });
  }

  private replaceNote(n: CareNote): void {
    this.items = this.items.map(i => (i.note && i.note.id === n.id ? { ...i, note: n } : i));
    this.regroup();
  }
}
