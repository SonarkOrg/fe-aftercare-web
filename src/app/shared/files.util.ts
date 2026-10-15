export const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
export const MAX_BYTES = 10485760;

export function humanSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
}

export function typeLabel(contentType: string): string {
  return contentType === 'application/pdf' ? 'PDF' : contentType === 'image/jpeg' ? 'JPEG' : contentType === 'image/png' ? 'PNG' : contentType;
}

export function extensionOf(contentType: string): string {
  return contentType === 'application/pdf' ? 'pdf' : contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'bin';
}
