import { fmtFileSize } from '../i18n/format';
import '../testing/i18n-testing.module';
import { ACCEPT, MAX_BYTES, extensionOf, typeLabel } from './files.util';

describe('files.util', () => {
  it('formats sizes', () => {
    expect(fmtFileSize(0, 'en')).toBe('0\u00a0B');
    expect(fmtFileSize(1023, 'en')).toBe('1023\u00a0B');
    expect(fmtFileSize(2048, 'en')).toBe('2\u00a0KB');
    expect(fmtFileSize(1536 * 1024, 'en')).toBe('1.5\u00a0MB');
    expect(fmtFileSize(MAX_BYTES, 'en')).toBe('10.0\u00a0MB');
    expect(fmtFileSize(1.2 * 1024 * 1024, 'fr')).toBe('1,2\u00a0Mo');
    expect(fmtFileSize(850, 'fr')).toBe('850\u00a0o');
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
