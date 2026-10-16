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
