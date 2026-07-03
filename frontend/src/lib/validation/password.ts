import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

export const PASSWORDS_DO_NOT_MATCH_MESSAGE = 'Passwords do not match.'

export const PASSWORD_MESSAGES = {
  tooShort: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  missingUppercase: 'Password must contain at least one uppercase letter.',
  missingLowercase: 'Password must contain at least one lowercase letter.',
  missingDigit: 'Password must contain at least one digit.',
}

// Reusable checklist for rendering live "✓ 8+ chars / Uppercase / ..." style feedback.
export const PASSWORD_REQUIREMENTS: { test: (pw: string) => boolean; label: string }[] = [
  { test: pw => pw.length >= PASSWORD_MIN_LENGTH, label: `${PASSWORD_MIN_LENGTH}+ characters` },
  { test: pw => /[A-Z]/.test(pw), label: 'Uppercase letter' },
  { test: pw => /[a-z]/.test(pw), label: 'Lowercase letter' },
  { test: pw => /[0-9]/.test(pw), label: 'Number' },
]

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_REQUIREMENTS.every(r => r.test(pw))
}

// For non-react-hook-form pages: returns the first specific, actionable error, or null if valid.
export function validateNewPassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return PASSWORD_MESSAGES.tooShort
  if (!/[A-Z]/.test(pw)) return PASSWORD_MESSAGES.missingUppercase
  if (!/[a-z]/.test(pw)) return PASSWORD_MESSAGES.missingLowercase
  if (!/[0-9]/.test(pw)) return PASSWORD_MESSAGES.missingDigit
  return null
}

// Zod piece for react-hook-form schemas — same specific messages as validateNewPassword above.
export const newPasswordZodSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_MESSAGES.tooShort)
  .regex(/[A-Z]/, PASSWORD_MESSAGES.missingUppercase)
  .regex(/[a-z]/, PASSWORD_MESSAGES.missingLowercase)
  .regex(/[0-9]/, PASSWORD_MESSAGES.missingDigit)
