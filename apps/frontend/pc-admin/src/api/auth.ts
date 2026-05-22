import { http } from "./http";

export function login(payload: { username: string; password: string }) {
  return http.post<{ token: string }>("/api/login", payload, { withToken: false });
}

export function logout() {
  return http.post<Record<string, never> | undefined>(
    "/api/logout",
    {},
    {
      skipUnauthorizedDialog: true,
      showError: false,
    },
  );
}
