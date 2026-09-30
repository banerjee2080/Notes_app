// Every catch block in the app receives `unknown`. These helpers read the
// bits of an Axios error we actually use, without an `any` at each call site.
import axios, { type AxiosError } from "axios";

/** The error body our backend sends. Every field is optional by design. */
export interface ApiErrorBody {
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  [key: string]: unknown;
}

export const asApiError = <T = ApiErrorBody>(
  error: unknown,
): AxiosError<T> | null => (axios.isAxiosError<T>(error) ? error : null);

/** HTTP status, or undefined when the request never reached the server. */
export const errorStatus = (error: unknown): number | undefined =>
  asApiError(error)?.response?.status;

/** The server's `message`, then the thrown error's own, then `fallback`. */
export const errorMessage = (
  error: unknown,
  fallback = "Something went wrong",
): string => {
  const api = asApiError(error);
  if (api?.response?.data?.message) return api.response.data.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/** Typed access to the response body of a failed request. */
export const errorBody = <T = ApiErrorBody>(
  error: unknown,
): T | undefined => asApiError<T>(error)?.response?.data;
