export interface ApiError {
  status: number;
  error: string;
  message: string;
  fieldErrors: Record<string, string>;
}

/** Extracts the ApiError body from an HttpErrorResponse-like object, if present. */
export function apiErrorOf(err: unknown): ApiError | null {
  const body = (err as { error?: unknown } | null)?.error as Partial<ApiError> | null | undefined;
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    return { status: body.status ?? 0, error: body.error, message: body.message ?? '', fieldErrors: body.fieldErrors ?? {} };
  }
  return null;
}

export const FORBIDDEN_TEXT = "You don't have permission for this action.";

/** User-facing text for a failed request: a fixed sentence for FORBIDDEN, the server message for other ApiErrors, else the fallback. */
export function errorText(err: unknown, fallback: string): string {
  const api = apiErrorOf(err);
  if (!api) {
    return fallback;
  }
  if (api.error === 'FORBIDDEN') {
    return FORBIDDEN_TEXT;
  }
  return api.message || fallback;
}
