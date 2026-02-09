import type { ZodError } from 'zod';
import { ValidationError } from '@agentest/shared';

/**
 * Zodパース結果からValidationErrorを生成するヘルパー
 */
export function createValidationError(error: ZodError): ValidationError {
  const fieldErrors = error.flatten().fieldErrors;
  const details: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value) {
      details[key] = value;
    }
  }
  return new ValidationError('入力内容に誤りがあります', details);
}
