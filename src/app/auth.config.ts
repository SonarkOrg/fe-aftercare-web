import { environment } from '../environments/environment';

// Staff API URLs that receive the bearer token. /public/** and /dev/** are deliberately absent.
export const staffApiAllowedList = [
  `${environment.apiUrl}/patients`, `${environment.apiUrl}/patients/*`,
  `${environment.apiUrl}/follow-ups/*`,
  `${environment.apiUrl}/alerts`, `${environment.apiUrl}/alerts/*`,
  `${environment.apiUrl}/appointments`, `${environment.apiUrl}/appointments/*`,
  `${environment.apiUrl}/questionnaires`, `${environment.apiUrl}/questionnaires/*`,
];

function normalised(entry: string): string {
  try {
    const u = new URL(entry.endsWith('/*') ? entry.slice(0, -1) : entry, document.baseURI);
    return u.origin + u.pathname + (entry.endsWith('/*') ? '*' : '');
  } catch {
    return entry;
  }
}

export function isStaffApiUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, document.baseURI);
  } catch {
    return false;
  }
  if (/\/\.\.|%2e/i.test(parsed.pathname) || /\/\.\.|%2e/i.test(url.split('#')[0].split('?')[0])) {
    return false;
  }
  const path = parsed.origin + parsed.pathname;
  return staffApiAllowedList.some(rawEntry => {
    const entry = normalised(rawEntry);
    if (entry.endsWith('/*')) {
      const prefix = entry.slice(0, -1);
      return path.startsWith(prefix) && path.length > prefix.length;
    }
    return path === entry;
  });
}
