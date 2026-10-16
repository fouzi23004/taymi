/** An error carrying a stable code that maps to an `errors.*` translation key. */
export class AppError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code)
  }
}

const CODE_TO_KEY: Record<string, string> = {
  day_overflow: 'errors.dayOverflow',
  task_client_mismatch: 'errors.taskClientMismatch',
  last_admin: 'errors.lastAdmin',
  email_taken: 'errors.emailTaken',
  invalid_email: 'errors.invalidEmail',
  weak_password: 'errors.weakPassword',
  cannot_deactivate_self: 'errors.cannotDeactivateSelf',
  forbidden: 'errors.forbidden',
  function_unavailable: 'errors.functionUnavailable',
}

/** Translation key for any error thrown by Supabase, the edge function or our code. */
export function errorKey(err: unknown): string {
  if (err instanceof AppError) return CODE_TO_KEY[err.code] ?? 'errors.generic'
  if (err && typeof err === 'object') {
    const e = err as { code?: string; hint?: string; message?: string }
    if (e.hint && CODE_TO_KEY[e.hint]) return CODE_TO_KEY[e.hint]
    if (e.code === '23505') return 'errors.duplicate'
    if (e.code === '23503') return 'errors.inUse'
    if (e.code === '42501') return 'errors.forbidden'
    if (e.message && /weak|at least 8|should be at least/i.test(e.message)) return 'errors.weakPassword'
  }
  return 'errors.generic'
}
