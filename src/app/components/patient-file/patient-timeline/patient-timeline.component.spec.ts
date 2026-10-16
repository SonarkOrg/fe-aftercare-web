import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { TimelineItem } from '../../../models/timeline.model';
import { careNote, timelineItem, providePermissions } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { PatientTimelineComponent } from './patient-timeline.component';
import { I18nTestingModule } from '../../../testing/i18n-testing.module';

describe('PatientTimelineComponent', () => {
  let fixture: ComponentFixture<PatientTimelineComponent>;
  let component: PatientTimelineComponent;
  let http: HttpTestingController;
  let el: HTMLElement;
  const url = `${environment.apiUrl}/patients/5/timeline`;
  const page = (items: TimelineItem[], hasMore = false, p = 0) => ({ items, page: p, size: 30, hasMore });
  const tl = () => http.expectOne(r => r.url === url);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [providePermissions('NURSE')],
      imports: [I18nTestingModule.forLang(), HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [PatientTimelineComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientTimelineComponent);
    component = fixture.componentInstance;
    component.patientId = 5;
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  const init = async (items: TimelineItem[] = [], hasMore = false) => {
    await settle();
    const r = tl();
    expect(r.request.params.get('page')).toBe('0');
    expect(r.request.params.get('size')).toBe('30');
    r.flush(page(items, hasMore));
    await settle();
  };
  /** ngModel connects its controls (and writes values / disabled) in a microtask: wait for it, then render. */
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const noteItem = (over = {}, noteOver = {}) => timelineItem({
    id: 1, category: 'NOTE', kind: 'NOTE_ADDED', actorType: 'STAFF', actorName: 'Dev Nurse', refId: 30, summary: 'Note', note: careNote(noteOver), ...over
  });
  const type = async (sel: string, value: string) => {
    const input = q<HTMLInputElement>(sel);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  it('shows the empty state', async () => {
    await init([]);
    expect(el.textContent).toContain('Nothing here yet.');
  });

  it('filters with a single-select pill: All sends no category, Notes sends category=NOTE', async () => {
    await init([]);
    const pills = Array.from(el.querySelectorAll<HTMLButtonElement>('.timeline-filter .pill-group__item'));
    expect(pills.map(p => p.textContent!.trim())).toEqual(['All', 'Notes', 'Check-ins', 'Alerts', 'Appointments', 'Follow-up', 'Documents', 'Messages']);
    expect(pills[0].getAttribute('aria-pressed')).toBe('true');
    pills[1].click();
    await settle();
    const r = tl();
    expect(r.request.params.getAll('category')).toEqual(['NOTE']);
    expect(r.request.params.get('page')).toBe('0');
    r.flush(page([]));
    await settle();
    expect(pills[1].getAttribute('aria-pressed')).toBe('true');
    expect(pills[0].getAttribute('aria-pressed')).toBe('false');
    pills[0].click();
    await settle();
    const all = tl();
    expect(all.request.params.has('category')).toBeFalse();
    all.flush(page([]));
  });

  it('groups items under day headers in America/Toronto time', async () => {
    await init([
      timelineItem({ id: 3, occurredAt: '2026-10-14T20:00:00Z' }),
      timelineItem({ id: 2, occurredAt: '2026-10-14T05:00:00Z' }),
      timelineItem({ id: 1, occurredAt: '2026-10-14T03:30:00Z' }) // still Oct 13 in Toronto
    ]);
    const days = Array.from(el.querySelectorAll('h3.label-day')).map(h => h.textContent!.trim());
    expect(days).toEqual(['Wednesday 14 October', 'Tuesday 13 October']);
    expect(el.querySelectorAll('.timeline-row').length).toBe(3);
    const first = q('.timeline-row .row__sub').textContent!;
    expect(first).toBe('16:00 · Patient');
  });

  it('shows the summary, a glyph tone and "System" for system actors', async () => {
    await init([timelineItem({ id: 1, category: 'ALERT', kind: 'ALERT_CREATED', severity: 'HIGH', actorType: 'SYSTEM', summary: 'High alert: Pain 8' })]);
    const row = q('.timeline-row');
    expect(row.querySelector('.tone-circle')!.textContent!.trim()).toBe('▲');
    expect(row.querySelector('.row__name')!.textContent).toContain('High alert: Pain 8');
    expect(row.querySelector('.row__sub')!.textContent).toContain('System');
  });

  it('alert and document rows open their tab; appointment rows link to the appointment', async () => {
    await init([
      timelineItem({ id: 1, category: 'ALERT', kind: 'ALERT_RESOLVED', summary: 'Alert resolved: x' }),
      timelineItem({ id: 2, category: 'DOCUMENT', kind: 'DOCUMENT_UPLOADED', summary: 'Document uploaded: x' }),
      timelineItem({ id: 3, category: 'APPOINTMENT', kind: 'APPOINTMENT_CREATED', refId: 8, summary: 'Pre op consult scheduled' }),
      timelineItem({ id: 4, category: 'APPOINTMENT', kind: 'APPOINTMENT_DELETED', refId: 9, summary: 'Pre op consult on 2026-10-14 deleted' })
    ]);
    const opened: string[] = [];
    component.openTab.subscribe(t => opened.push(t));
    const rows = el.querySelectorAll('.timeline-row');
    (rows[0].querySelector('.plain-link') as HTMLButtonElement).click();
    (rows[1].querySelector('.plain-link') as HTMLButtonElement).click();
    expect(opened).toEqual(['alerts', 'documents']);
    expect(rows[2].querySelector('a.plain-link')!.getAttribute('href')).toBe('/appointments/8');
    expect(rows[3].querySelector('a')).toBeNull();
  });

  describe('notes', () => {
    it('shows the body and an Edit button (titled with the deadline) only for an editable note', async () => {
      await init([noteItem(), noteItem({ id: 2 }, { id: 31, editableByMe: false, deletableByMe: false, body: 'Other nurse note' })]);
      const rows = el.querySelectorAll('.timeline-row');
      expect(rows[0].querySelector('.note-body')!.textContent).toBe('Wound looks clean.');
      expect(rows[0].querySelector('.edit-note')).not.toBeNull();
      expect(rows[0].querySelector('.edit-note')!.getAttribute('title')).toMatch(/^Editable until \d{2}:\d{2}$/);
      expect(rows[1].querySelector('.edit-note')).toBeNull();
      expect(rows[1].querySelector('.delete-note')).toBeNull();
    });

    it('hides Edit once the deadline has passed even if the flag is stale', async () => {
      await init([noteItem({}, { editableUntil: new Date(Date.now() - 1000).toISOString() })]);
      expect(el.querySelector('.edit-note')).toBeNull();
      expect(el.querySelector('.delete-note')).not.toBeNull();
    });

    it('edits inline and replaces the note with the saved one', async () => {
      await init([noteItem()]);
      q<HTMLButtonElement>('.edit-note').click();
      await settle();
      expect(q<HTMLTextAreaElement>('.edit-body').value).toBe('Wound looks clean.');
      await type('.edit-body', 'Wound looks clean and dry.');
      q<HTMLButtonElement>('.save-edit').click();
      const r = http.expectOne(`${environment.apiUrl}/notes/30`);
      expect(r.request.method).toBe('PUT');
      expect(r.request.body).toEqual({ body: 'Wound looks clean and dry.' });
      r.flush(careNote({ body: 'Wound looks clean and dry.', editedAt: '2026-10-14T15:05:00Z' }));
      await settle();
      expect(q('.note-body').textContent).toBe('Wound looks clean and dry.');
      expect(q('.timeline-row .row__sub').textContent).toContain('edited');
      expect(el.querySelector('.edit-body')).toBeNull();
    });

    it('shows the server message when the edit window has closed', async () => {
      await init([noteItem()]);
      q<HTMLButtonElement>('.edit-note').click();
      await settle();
      q<HTMLButtonElement>('.save-edit').click();
      http.expectOne(`${environment.apiUrl}/notes/30`).flush(
        { status: 409, error: 'EDIT_WINDOW_CLOSED', message: 'Notes can only be edited within 15 minutes', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(el.textContent).toContain('Notes can only be edited within 15 minutes');
      tl().flush(page([noteItem({}, { editableByMe: false })])); // the list reloads
    });

    it('"Mark as entered in error" needs a reason, then POSTs it', async () => {
      await init([noteItem()]);
      q<HTMLButtonElement>('.delete-note').click();
      await settle();
      const ok = q<HTMLButtonElement>('.confirm-inline__ok');
      expect(ok.disabled).toBeTrue();
      await type('app-confirm-inline textarea', 'ab');
      expect(q<HTMLButtonElement>('.confirm-inline__ok').disabled).toBeTrue();
      http.expectNone(`${environment.apiUrl}/notes/30/delete`);
      await type('app-confirm-inline textarea', 'Wrong patient');
      q<HTMLButtonElement>('.confirm-inline__ok').click();
      const r = http.expectOne(`${environment.apiUrl}/notes/30/delete`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ reason: 'Wrong patient' });
      r.flush(careNote({ body: null, deleted: true, deletedAt: '2026-10-14T16:00:00Z', deletedByName: 'Dev Nurse', deleteReason: 'Wrong patient', editableByMe: false, deletableByMe: false }));
      await settle();
      expect(el.querySelector('.note-body')).toBeNull();
    });

    it('a deleted note shows the removal text and no body', async () => {
      await init([noteItem({}, { body: null, deleted: true, deletedAt: '2026-10-14T16:00:00Z', deletedByName: 'Sam Doc', deleteReason: 'Wrong patient', editableByMe: false, deletableByMe: false })]);
      const removed = q('.note-removed');
      expect(removed.textContent!.replace(/\s+/g, ' ').trim()).toMatch(/^⊘ Note removed by Sam Doc on 14 Oct: Wrong patient$/);
      expect(el.querySelector('.note-body')).toBeNull();
      expect(el.querySelector('.edit-note')).toBeNull();
      expect(el.querySelector('.delete-note')).toBeNull();
    });

    it('clamps a long note with Show more / Show less', async () => {
      await init([noteItem({}, { body: 'x'.repeat(300) })]);
      expect(q('.note-body').classList).toContain('is-clamped');
      const more = q<HTMLButtonElement>('.show-more');
      expect(more.textContent!.trim()).toBe('Show more');
      more.click();
      await settle();
      expect(q('.note-body').classList).not.toContain('is-clamped');
      expect(q('.show-more').textContent!.trim()).toBe('Show less');
    });

    it('renders the note body as text, never as HTML', async () => {
      await init([noteItem({}, { body: '<img src=x onerror=alert(1)>' })]);
      expect(q('.note-body').textContent).toBe('<img src=x onerror=alert(1)>');
      expect(el.querySelector('.timeline-row img')).toBeNull();
    });
  });

  describe('composer', () => {
    it('counts characters and saves a note, then reloads from page 0 and clears', async () => {
      await init([]);
      expect(q<HTMLButtonElement>('.save-note').disabled).toBeTrue();
      await type('#note-body', 'Patient walking well');
      expect(q('.composer-card .composer__count').textContent).toContain('20 / 5000');
      expect(q<HTMLTextAreaElement>('#note-body').getAttribute('maxlength')).toBe('5000');
      q<HTMLButtonElement>('.save-note').click();
      const r = http.expectOne(`${environment.apiUrl}/patients/5/notes`);
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toEqual({ body: 'Patient walking well', notedAt: null });
      r.flush(careNote(), { status: 201, statusText: 'Created' });
      const reload = tl();
      expect(reload.request.params.get('page')).toBe('0');
      reload.flush(page([noteItem()]));
      await settle();
      expect(q<HTMLTextAreaElement>('#note-body').value).toBe('');
      expect(el.querySelectorAll('.timeline-row').length).toBe(1);
    });

    it('sends the optional "noted at" as an instant', async () => {
      await init([]);
      await type('#note-body', 'Late entry');
      await type('#note-at', '2026-10-14T09:30');
      q<HTMLButtonElement>('.save-note').click();
      const r = http.expectOne(`${environment.apiUrl}/patients/5/notes`);
      expect(r.request.body.notedAt).toBe(new Date('2026-10-14T09:30').toISOString());
      r.flush({}, { status: 500, statusText: 'x' });
    });

    it('shows the server error for the date', async () => {
      await init([]);
      await type('#note-body', 'Late entry');
      q<HTMLButtonElement>('.save-note').click();
      http.expectOne(`${environment.apiUrl}/patients/5/notes`).flush(
        { status: 400, error: 'VALIDATION_FAILED', message: '', fieldErrors: { notedAt: 'must be within the last 7 days' } }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(q('.composer-card .banner--error').textContent).toContain('Must be within the last 7 days.');
      expect(q<HTMLTextAreaElement>('#note-body').value).toBe('Late entry');
    });
  });

  describe('paging', () => {
    it('Load more appends the next page while hasMore, then disappears', async () => {
      await init([timelineItem({ id: 5 })], true);
      expect(el.querySelectorAll('.timeline-row').length).toBe(1);
      q<HTMLButtonElement>('.load-more').click();
      const r = tl();
      expect(r.request.params.get('page')).toBe('1');
      r.flush(page([timelineItem({ id: 4, occurredAt: '2026-10-13T15:00:00Z' })], false, 1));
      await settle();
      expect(el.querySelectorAll('.timeline-row').length).toBe(2);
      expect(el.querySelector('.load-more')).toBeNull();
    });

    it('shows a retry when the first load fails', async () => {
      await settle();
      tl().flush('x', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(el.textContent).toContain('Could not load the timeline');
      q<HTMLButtonElement>('.retry-timeline').click();
      tl().flush(page([]));
    });
  });
});
