import { http } from "./http";

export function login(payload: { username: string; password: string }) {
  return http.post<{ token: string }>("/api/login", payload);
}
