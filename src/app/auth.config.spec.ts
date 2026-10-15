import { isStaffApiUrl, staffApiAllowedList } from './auth.config';
import { environment } from '../environments/environment';

describe('staffApiAllowedList', () => {
  const api = environment.apiUrl;

  it('contains exactly the 10 staff entries', () => {
    expect(staffApiAllowedList).toEqual([
      `${api}/patients`, `${api}/patients/*`,
      `${api}/follow-ups/*`,
      `${api}/alerts`, `${api}/alerts/*`,
      `${api}/check-ins`,
      `${api}/appointments`, `${api}/appointments/*`,
      `${api}/questionnaires`, `${api}/questionnaires/*`
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
});
