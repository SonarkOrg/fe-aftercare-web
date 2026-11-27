import { isBurst } from './scan-input';

const every = (gap: number, n: number): number[] => Array.from({ length: n }, (_, i) => 1000 + i * gap);

describe('isBurst', () => {
  it('is false for fewer than 12 keys, however fast', () => {
    expect(isBurst([])).toBeFalse();
    expect(isBurst(every(5, 11))).toBeFalse();
  });

  it('is true for 12 or more keys at an average gap under 35 ms', () => {
    expect(isBurst(every(5, 12))).toBeTrue();
    expect(isBurst(every(34, 20))).toBeTrue();
  });

  it('is false at 35 ms or more, and for a person typing', () => {
    expect(isBurst(every(35, 12))).toBeFalse();
    expect(isBurst(every(120, 14))).toBeFalse();
  });

  it('uses the average: one pause among fast keys can still be a burst, a long pause is not', () => {
    const ts = every(5, 12);
    ts[11] += 20; // one slower key
    expect(isBurst(ts)).toBeTrue();
    ts[11] += 600;
    expect(isBurst(ts)).toBeFalse();
  });
});
