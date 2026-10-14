import { apiAllowedList } from './auth.config';
import { environment } from '../environments/environment';

describe('apiAllowedList', () => {
  it('contains exactly the patients endpoints', () => {
    expect(apiAllowedList).toEqual([
      `${environment.apiUrl}/patients`,
      `${environment.apiUrl}/patients/*`
    ]);
  });
});
