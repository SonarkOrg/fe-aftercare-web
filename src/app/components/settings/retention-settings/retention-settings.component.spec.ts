import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { retentionRun, retentionSettings } from '../../../testing/fixtures';
import { SHARED_DECLARATIONS } from '../../../testing/shared-declarations';
import { RetentionSettingsComponent } from './retention-settings.component';

describe('RetentionSettingsComponent', () => {
  const api = environment.apiUrl;
  const NOTICE = "Retention periods must be set by the clinic's privacy officer (responsable de la protection des renseignements personnels) according to your retention schedule. The app does not assume any legal period. Empty = keep indefinitely.";
  let fixture: ComponentFixture<RetentionSettingsComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule],
      declarations: [RetentionSettingsComponent, ...SHARED_DECLARATIONS]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RetentionSettingsComponent);
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  async function init(settings: object = retentionSettings(), runs: object[] = []) {
    await settle();
    http.expectOne(`${api}/settings/retention`).flush(settings);
    http.expectOne(`${api}/retention/runs`).flush(runs);
    await settle();
  }
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const input = (field: string) => q<HTMLInputElement>(`#ret-${field}`);
  const keep = (field: string) => q<HTMLInputElement>(`[data-field=${field}] .ret-keep input`);
  const type = async (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    await settle();
  };
  const uncheckKeep = async (field: string) => {
    keep(field).click();
    await settle();
  };
  const submit = async () => {
    q<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await settle();
  };

  it('always shows the privacy-officer notice, even before and without data', async () => {
    await settle();
    expect(q('.retention-notice').textContent).toBe('●' + NOTICE);
    expect(q('.retention-notice strong').textContent).toBe(NOTICE);
    http.expectOne(`${api}/settings/retention`).flush('x', { status: 500, statusText: 'Server Error' });
    http.expectOne(`${api}/retention/runs`).flush([]);
    await settle();
    expect(q('.retention-notice')).not.toBeNull();
    expect(q('.banner--error').textContent).toContain('Could not load the retention settings.');
  });

  it('has the five rows with their labels and help; empty periods are "Keep indefinitely" and disabled', async () => {
    await init();
    expect(Array.from(el.querySelectorAll('.ret-row > .form-group > label')).map(l => l.textContent)).toEqual([
      'Closed or expired follow-ups (with their check-ins and alerts)', 'Documents marked deleted', 'Patient messages', 'Notification history', 'Access log']);
    expect(q('[data-field=deletedDocumentMonths] .ret-help').textContent).toContain('Active documents are never purged automatically.');
    expect(q('[data-field=auditMonths] .ret-help').textContent).toContain('Applies only to access-log entries; other purges never delete them.');
    for (const f of ['closedFollowUpMonths', 'deletedDocumentMonths', 'messageMonths', 'notificationMonths', 'auditMonths']) {
      expect(keep(f).checked).withContext(f).toBeTrue();
      expect(input(f).disabled).withContext(f).toBeTrue();
      expect(input(f).min).toBe(f === 'auditMonths' ? '12' : '1');
      expect(input(f).max).toBe('1200');
    }
  });

  it('fills the stored periods and enables their inputs', async () => {
    await init(retentionSettings({ messageMonths: 84, auditMonths: 120 }));
    expect(input('messageMonths').value).toBe('84');
    expect(input('messageMonths').disabled).toBeFalse();
    expect(keep('messageMonths').checked).toBeFalse();
    expect(input('auditMonths').value).toBe('120');
    expect(input('closedFollowUpMonths').disabled).toBeTrue();
  });

  it('"Keep indefinitely" nulls the value, disables the input and is sent as null', async () => {
    await init(retentionSettings({ messageMonths: 84 }));
    await uncheckKeep('messageMonths'); // tick "keep indefinitely"
    expect(input('messageMonths').disabled).toBeTrue();
    await submit();
    const r = http.expectOne(`${api}/settings/retention`);
    expect(r.request.body.messageMonths).toBeNull();
    r.flush(retentionSettings());
    await settle();
  });

  it('PUTs exactly the five periods (months or null)', async () => {
    await init();
    await uncheckKeep('closedFollowUpMonths');
    await type('closedFollowUpMonths', '24');
    await uncheckKeep('messageMonths');
    await type('messageMonths', '84');
    await submit();
    expect(q('.confirm-inline')).not.toBeNull(); // null -> number shortens: a confirmation first
    q<HTMLButtonElement>('.confirm-inline__ok').click();
    await settle();
    const r = http.expectOne(`${api}/settings/retention`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ closedFollowUpMonths: 24, deletedDocumentMonths: null, messageMonths: 84, notificationMonths: null, auditMonths: null });
    r.flush(retentionSettings({ closedFollowUpMonths: 24, messageMonths: 84, updatedByName: 'Dev Admin' }));
    await settle();
    expect(q('[role=status]').textContent).toContain('Saved.');
  });

  describe('the shorten confirmation', () => {
    const body = (over: object) => ({ closedFollowUpMonths: null, deletedDocumentMonths: null, messageMonths: null, notificationMonths: null, auditMonths: null, ...over });

    it('appears when a period goes from indefinite to a number, and Cancel sends nothing', async () => {
      await init();
      await uncheckKeep('auditMonths');
      await type('auditMonths', '60');
      await submit();
      expect(q('.confirm-inline__q').textContent).toBe('Shortening a period can delete data on the next purge. Continue?');
      http.expectNone(`${api}/settings/retention`);
      q<HTMLButtonElement>('.confirm-inline__cancel').click();
      await settle();
      expect(q('.confirm-inline')).toBeNull();
      http.expectNone(`${api}/settings/retention`);
    });

    it('appears when a number decreases', async () => {
      await init(retentionSettings({ messageMonths: 84 }));
      await type('messageMonths', '48');
      await submit();
      expect(q('.confirm-inline')).not.toBeNull();
    });

    it('does not appear when a number increases, stays equal, or becomes indefinite', async () => {
      await init(retentionSettings({ messageMonths: 84, auditMonths: 120 }));
      await type('messageMonths', '96'); // longer
      await submit();
      expect(q('.confirm-inline')).toBeNull();
      http.expectOne(`${api}/settings/retention`).flush(retentionSettings({ messageMonths: 96, auditMonths: 120 }));
      await settle();

      await submit(); // nothing changed
      expect(q('.confirm-inline')).toBeNull();
      http.expectOne(`${api}/settings/retention`).flush(retentionSettings({ messageMonths: 96, auditMonths: 120 }));
      await settle();

      await uncheckKeep('auditMonths'); // 120 -> indefinite
      await submit();
      expect(q('.confirm-inline')).toBeNull();
      const r = http.expectOne(`${api}/settings/retention`);
      expect(r.request.body).toEqual(body({ messageMonths: 96 }));
      r.flush(retentionSettings({ messageMonths: 96 }));
      await settle();
    });
  });

  it('refuses blank and out-of-range values, with the server wording, before any request', async () => {
    await init(retentionSettings({ messageMonths: 84 }));
    await type('messageMonths', '0');
    await submit();
    expect(q('[data-field=messageMonths] .field-error').textContent).toBe('must be between 1 and 1200 months');
    await type('messageMonths', '1201');
    await submit();
    expect(q('[data-field=messageMonths] .field-error').textContent).toBe('must be between 1 and 1200 months');
    await type('messageMonths', '');
    await submit();
    expect(q('[data-field=messageMonths] .field-error').textContent).toContain('keep indefinitely');
    http.expectNone(`${api}/settings/retention`);
  });

  it('maps server fieldErrors onto their rows', async () => {
    await init(retentionSettings({ messageMonths: 84 }));
    await submit();
    http.expectOne(`${api}/settings/retention`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: 'x', fieldErrors: { messageMonths: 'must be between 1 and 1200 months' } },
      { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('[data-field=messageMonths] .field-error').textContent).toBe('must be between 1 and 1200 months');
  });

  it('the access-log input has min=12 and shows the server error "must be at least 12 months" under it', async () => {
    await init(retentionSettings({ auditMonths: 24 }));
    expect(input('auditMonths').getAttribute('min')).toBe('12');
    expect(input('messageMonths').getAttribute('min')).toBe('1');
    await type('auditMonths', '6');
    await submit();
    // refused locally with the same wording; nothing is sent
    expect(q('[data-field=auditMonths] .field-error').textContent).toBe('must be at least 12 months');
    http.expectNone(`${api}/settings/retention`);
    await type('auditMonths', '24');
    await submit();
    http.expectOne(`${api}/settings/retention`).flush(
      { status: 400, error: 'VALIDATION_FAILED', message: 'x', fieldErrors: { auditMonths: 'must be at least 12 months' } },
      { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(q('[data-field=auditMonths] .field-error').textContent).toBe('must be at least 12 months');
  });

  it('keeping the access log indefinitely (null) is still allowed', async () => {
    await init(retentionSettings({ auditMonths: null }));
    expect(keep('auditMonths').checked).toBeTrue();
    expect(input('auditMonths').disabled).toBeTrue();
  });

  describe('automatic purge status line', () => {
    const status = () => q('.purge-status .chip');

    it('off', async () => {
      await init(retentionSettings({ purgeEnabled: false, dryRun: true }));
      expect(status().textContent).toContain('Automatic purge: off (server setting)');
      expect(status().classList).toContain('chip--neutral');
    });

    it('dry run only', async () => {
      await init(retentionSettings({ purgeEnabled: true, dryRun: true }));
      expect(status().textContent).toContain('Automatic purge: dry run only (nothing is deleted)');
      expect(status().classList).toContain('chip--warning');
    });

    it('ON is critical, with a glyph', async () => {
      await init(retentionSettings({ purgeEnabled: true, dryRun: false }));
      expect(status().textContent).toContain('Automatic purge: ON: data older than these periods is deleted nightly at 03:15');
      expect(status().classList).toContain('chip--critical');
      expect(status().querySelector('.chip__glyph')!.textContent).toBe('▲');
    });
  });

  describe('Preview (dry run)', () => {
    it('POSTs the dry run and shows the counts and "Nothing was deleted."', async () => {
      await init();
      q<HTMLButtonElement>('.dry-run').click();
      const r = http.expectOne(`${api}/retention/dry-run`);
      expect(r.request.method).toBe('POST');
      r.flush(retentionRun());
      http.expectOne(`${api}/retention/runs`).flush([retentionRun()]); // the runs list refreshes
      await settle();
      const rows = Array.from(el.querySelectorAll('.dry-result tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent!.trim()));
      expect(rows).toEqual([['Follow-ups', '3'], ['Check-ins', '20'], ['Alerts', '4'], ['Documents', '0'], ['Messages', '12'], ['Notifications', '40'], ['Access-log entries', '0']]);
      expect(q('.dry-result').textContent).toContain('Nothing was deleted.');
    });

    it('shows an error when the preview fails (409 run in progress)', async () => {
      await init();
      q<HTMLButtonElement>('.dry-run').click();
      http.expectOne(`${api}/retention/dry-run`).flush({ status: 409, error: 'INVALID_STATE', message: 'A retention run is already in progress', fieldErrors: {} }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(q('.banner--error').textContent).toContain('A retention run is already in progress');
      expect(q('.dry-result')).toBeNull();
    });
  });

  describe('Recent runs', () => {
    it('lists started, mode, trigger, status, the total with its parts, and who', async () => {
      await init(retentionSettings(), [
        retentionRun(),
        retentionRun({ id: 2, mode: 'PURGE', trigger: 'SCHEDULED', status: 'FAILED', actorName: null, counts: { followUps: 0, checkIns: 0, alerts: 0, documents: 0, messages: 1, notifications: 2, auditEvents: 0 } })]);
      const rows = Array.from(el.querySelectorAll('.retention-runs tbody tr'));
      expect(rows.length).toBe(2);
      const cells = (i: number) => Array.from(rows[i].querySelectorAll('td')).map(td => td.textContent!.replace(/\s+/g, ' ').trim());
      expect(cells(0)).toEqual(['2026-10-14 11:00', 'Dry run', 'Manual', '✓Succeeded', '79Follow-ups: 3, Check-ins: 20, Alerts: 4, Documents: 0, Messages: 12, Notifications: 40, Access-log entries: 0', 'Dev Admin']);
      expect(cells(1)[1]).toBe('Purge');
      expect(cells(1)[2]).toBe('Scheduled');
      expect(cells(1)[3]).toBe('▲Failed');
      expect(cells(1)[4]).toContain('3');
      expect(cells(1)[5]).toBe('Automatic');
      expect(rows[0].querySelector('summary')!.getAttribute('title')).toContain('Messages: 12');
    });

    it('says so when there are none, and offers a retry when the list fails', async () => {
      await settle();
      http.expectOne(`${api}/settings/retention`).flush(retentionSettings());
      http.expectOne(`${api}/retention/runs`).flush('x', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(q('.retention-runs .banner--error').textContent).toContain('Could not load the recent runs.');
      q<HTMLButtonElement>('.retention-runs .banner--error button').click();
      http.expectOne(`${api}/retention/runs`).flush([]);
      await settle();
      expect(q('.retention-runs').textContent).toContain('No runs yet.');
    });
  });
});
