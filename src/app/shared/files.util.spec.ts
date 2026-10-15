import { ACCEPT, MAX_BYTES, extensionOf, humanSize, typeLabel } from './files.util';

describe('files.util', () => {
  it('formats sizes', () => {
    expect(humanSize(0)).toBe('0 B');
    expect(humanSize(1023)).toBe('1023 B');
    expect(humanSize(2048)).toBe('2 KB');
    expect(humanSize(1536 * 1024)).toBe('1.5 MB');
    expect(humanSize(MAX_BYTES)).toBe('10.0 MB');
  });

  it('has the 10 MB limit and the accepted types', () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(ACCEPT).toBe('.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png');
  });

  it('labels and extensions', () => {
    expect(typeLabel('application/pdf')).toBe('PDF');
    expect(typeLabel('image/jpeg')).toBe('JPEG');
    expect(typeLabel('image/png')).toBe('PNG');
    expect(extensionOf('image/jpeg')).toBe('jpg');
    expect(extensionOf('application/pdf')).toBe('pdf');
  });
});
