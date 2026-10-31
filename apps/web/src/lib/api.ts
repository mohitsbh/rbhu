// Axios client: attaches JWT, normalises API errors, redirects on 401.
import axios from "axios";

export const TOKEN_KEY = "rbhu.token";
export const USER_KEY = "rbhu.user";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a readable server message (e.g. validation errors) for display. */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as
      | { error?: string; details?: Record<string, string[]> }
      | undefined;
    if (d?.details && typeof d.details === "object") {
      const first = Object.entries(d.details)[0];
      if (first) return `${first[0]}: ${String(first[1])}`;
    }
    if (d?.error) return d.error;
    return err.message;
  }
  return err instanceof Error ? err.message : "Unexpected error";
}
