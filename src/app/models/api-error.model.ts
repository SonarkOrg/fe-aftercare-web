import type { PatientMatch } from './arrival.model';

export interface ApiErrorDetails {
  candidates?: PatientMatch[];
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  reason?: string;
}

export interface ApiError {
  status: number;
  error: string;
  message: string;
  fieldErrors: Record<string, string>;
  details?: ApiErrorDetails;
}

/** Extracts the ApiError body from an HttpErrorResponse-like object, if present. */
export function apiErrorOf(err: unknown): ApiError | null {
  const body = (err as { error?: unknown } | null)?.error as Partial<ApiError> | null | undefined;
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    const out: ApiError = { status: body.status ?? 0, error: body.error, message: body.message ?? '', fieldErrors: body.fieldErrors ?? {} };
    if (body.details && typeof body.details === 'object') {
      out.details = body.details;
    }
    return out;
  }
  return null;
}
