import { isStaffApiUrl, staffApiAllowedList } from './auth.config';
import { environment } from '../environments/environment';

describe('staffApiAllowedList', () => {
  const api = environment.apiUrl;

  it('contains exactly the 21 staff entries', () => {
    expect(staffApiAllowedList).toEqual([
      `${api}/patients`, `${api}/patients/*`,
      `${api}/follow-ups/*`,
      `${api}/alerts`, `${api}/alerts/*`,
      `${api}/check-ins`,
      `${api}/appointments`, `${api}/appointments/*`,
      `${api}/questionnaires`, `${api}/questionnaires/*`,
      `${api}/notes/*`,
      `${api}/documents/*`,
      `${api}/messages/*`,
      `${api}/staff`, `${api}/staff/*`,
      `${api}/settings/*`,
      `${api}/reports/*`,
      `${api}/me`, `${api}/me/preferences`,
      `${api}/audit`,
      `${api}/retention/*`
    ]);
  });

  it('matches staff URLs, ignoring query and fragment', () => {
    for (const path of ['/patients', '/patients/5', '/alerts?status=OPEN', '/appointments/metrics?from=2026-10-14&to=2026-10-14',
      '/follow-ups/3/close', '/check-ins', '/check-ins?from=2026-10-01&to=2026-10-14', '/questionnaires/2', '/patients/5/check-ins#x']) {
      expect(isStaffApiUrl(api + path)).withContext(path).toBeTrue();
    }
  });

  it('rejects public, dev and look-alike URLs', () => {
    for (const url of [`${api}/public/q/abc`, api.replace(/\/api$/, '') + '/dev/token', `${api}/patientsX`,
      `${api}/follow-ups`, `${api}/follow-ups/`, `${api}/check-ins/`, `${api}/check-insX`, `${api}/public/check-ins`, 'https://evil.example/api/patients']) {
      expect(isStaffApiUrl(url)).withContext(url).toBeFalse();
    }
  });

  it('rejects dot-segment and encoded dot-segment traversal', () => {
    for (const url of [`${api}/patients/../public/q/abc`, `${api}/patients/%2e%2e/public/q/abc`, `${api}/patients/%2E%2E/public/q/abc`]) {
      expect(isStaffApiUrl(url)).withContext(url).toBeFalse();
    }
  });

  it('matches the patient-file, notes, documents, messages, staff, settings and reports endpoints', () => {
    for (const path of ['/notes/5', '/documents/3/content', '/messages/inbox', '/messages/unread-count', '/staff', '/staff/2/deactivate',
      '/settings/clinic', '/reports/summary?from=2026-10-01&to=2026-10-15', '/patients/1/messages/read', '/patients/1/medical',
      '/patients/1/health-number/reveal', '/patients/1/documents']) {
      expect(isStaffApiUrl(api + path)).withContext(path).toBeTrue();
    }
  });

  it('never matches the public message endpoints or look-alikes', () => {
    for (const path of ['/public/q/abc/messages', '/public/q/abc/messages/read', '/public/q/abc/messages?before=4', '/messages', '/staffing',
      '/documents', '/notes', '/messages/../public/q/x/messages', '/messages/%2e%2e/public/q/x', '/settings', '/reports']) {
      expect(isStaffApiUrl(api + path)).withContext(path).toBeFalse();
    }
  });

  it('matches the role, audit, retention, notification and send-link endpoints', () => {
    for (const path of ['/me', '/me/preferences', '/audit', '/audit?page=0&size=50&actorSub=dev%7Cadmin-1', '/retention/dry-run', '/retention/runs',
      '/settings/notifications', '/settings/retention', '/follow-ups/1/send-link', '/appointments/4/send-link',
      '/patients/5/contact-preferences', '/patients/5/notifications?page=0&size=20', '/patients/5/audit?actorSub=dev%7Cnurse-1']) {
      expect(isStaffApiUrl(api + path)).withContext(path).toBeTrue();
    }
  });

  it('still never attaches the staff token to public or dev URLs, or to look-alikes of the new entries', () => {
    const root = api.replace(/\/api$/, '');
    for (const url of [`${api}/public/q/x`, `${api}/public/q/x/messages`, `${root}/dev/token?role=ADMIN`, `${root}/dev/token?sub=dev%7Cunlinked`,
      `${api}/me/`, `${api}/me/preferences/`, `${api}/me/other`, `${api}/meX`, `${api}/audit/`, `${api}/auditX`, `${api}/retention`, `${api}/retention/`, `${api}/public/me`, `${api}/public/audit`,
      `${api}/public/retention/runs`, `${api}/me/../public/q/x`, `${api}/retention/%2e%2e/public/q/x`, 'https://evil.example/api/me']) {
      expect(isStaffApiUrl(url)).withContext(url).toBeFalse();
    }
  });
});
