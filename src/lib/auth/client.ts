"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Browser-side Neon Auth client — `authClient.useSession()`, `authClient.signOut()`,
// etc. No provider needed; the hook is backed by a nanostore.
export const authClient = createAuthClient();
