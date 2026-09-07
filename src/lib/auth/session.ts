import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./server";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

// The current signed-in user, or null. Memoized per request so multiple
// callers in one render/route pass share a single Neon Auth round trip.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id) return null;
  return { id: user.id, name: user.name, email: user.email, image: user.image ?? null };
});

// For Server Components / pages: send anonymous visitors to sign in, then
// return the user for the rest of the render.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}
