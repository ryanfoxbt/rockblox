import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";
import { isAdminEmail } from "./admin";

// For Server Components under /admin: send anyone who isn't the site admin
// back home rather than exposing analytics. Same allowlist as requireMathAdmin
// (see admin.ts) — this is just the site-wide surface instead of the
// RockBlocks Math one.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");
  return user!;
}
