import type { PostgrestError } from '@supabase/supabase-js';

export interface ToolTextResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export function ok(payload: unknown): ToolTextResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function fail(message: string, detail?: unknown): ToolTextResult {
  const body = detail
    ? `${message}\n\nDetail: ${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}`
    : message;
  return {
    content: [{ type: 'text', text: body }],
    isError: true,
  };
}

export function failFromPostgrest(context: string, err: PostgrestError): ToolTextResult {
  return fail(`${context}: ${err.message}`, {
    code: err.code,
    hint: err.hint,
    details: err.details,
  });
}
