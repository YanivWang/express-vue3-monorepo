import { http } from "./http";

import type {
  CurrentUserResult,
  MyProfileResult,
  PatchUserProfilePayload,
  UserProfileDetail,
} from "./types";

export function fetchCurrentUser(opts?: { silentUnauthorized?: boolean }) {
  return http.get<CurrentUserResult>("/api/me", {
    skipUnauthorizedDialog: opts?.silentUnauthorized === true,
  });
}

export function fetchMyProfile() {
  return http.get<MyProfileResult>("/api/me/profile");
}

export function patchMyProfile(body: PatchUserProfilePayload) {
  return http.patch<{ profile: UserProfileDetail }>("/api/me/profile", body);
}
