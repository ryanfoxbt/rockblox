import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";
import { isAdminEmail } from "./admin";

// RockWords has no general admin-role system either — same site admin
// allowlist every admin surface uses (see admin.ts), same shape as
// mathAdmin.ts.
export function isRockWordsAdmin(user: CurrentUser | null): boolean {
  return isAdminEmail(user?.email);
}

// For Server Components under /rockwords/admin: send anyone who isn't the
// site admin back to /rockwords rather than exposing the edit surface.
export async function requireRockWordsAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) redirect("/rockwords");
  return user!;
}
