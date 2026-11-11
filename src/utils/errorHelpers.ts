import { API_MESSAGE, HTTP_STATUS_MESSAGES } from "./constants.js";

// Other layers may translate a status first, then this helper chooses a safe message for the resulting satus
export const getHttpErrorMessage = (status: number): string => {
  return HTTP_STATUS_MESSAGES[status] ?? (status >= 500 ? API_MESSAGE.INTERNAL_SERVER_ERROR : API_MESSAGE.REQUEST_FAILED);
};

// Return a generic auth error message and a Supabase error code when available.
export async function getSafeSupabaseAuthError(response: Response): Promise<{ message: string; code?: string }> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    // Continue with a generic message if the response is not valid JSON.
  }

  if (typeof body !== "object" || body === null) {
    return { message: "Auth request failed" };
  }

  const fields = body as Record<string, unknown>;
  const code = [fields.code, fields.error_code].find(
    (value): value is string => typeof value === "string"
  );

  return { message: "Auth request failed", ...(code && { code }) };
}
