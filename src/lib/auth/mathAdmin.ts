import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";
import { isAdminEmail } from "./admin";

// RockBlocks Math has no general admin-role system — this is the same site
// admin allowlist every admin surface uses (see admin.ts), just under its
// original name so the existing call sites (and the "math" framing of the
// redirect below) didn't need to change when that list was generalized.
export function isMathAdmin(user: CurrentUser | null): boolean {
  return isAdminEmail(user?.email);
}

// For Server Components under /math/admin: send anyone who isn't the math
// curriculum admin back to /math rather than exposing the edit surface.
export async function requireMathAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!isMathAdmin(user)) redirect("/math");
  return user!;
}
