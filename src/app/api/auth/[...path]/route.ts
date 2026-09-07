import { auth } from "@/lib/auth/server";

// Proxies every client-side auth request (sign-in, sign-up, OAuth callbacks,
// session refresh, email verification) through to Neon Auth.
export const { GET, POST } = auth.handler();
