import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

// RockBlocks Math has no general admin-role system — this is a single
// hardcoded allowlist for the one person curating the curriculum. If this
// ever needs to support more than one editor, replace it with a real role
// column instead of extending this list.
const MATH_ADMIN_EMAILS = new Set(["ryanfoxbt@gmail.com"]);

export function isMathAdmin(user: CurrentUser | null): boolean {
  return !!user && MATH_ADMIN_EMAILS.has(user.email.toLowerCase());
}

// For Server Components under /math/admin: send anyone who isn't the math
// curriculum admin back to /math rather than exposing the edit surface.
export async function requireMathAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!isMathAdmin(user)) redirect("/math");
  return user!;
}
