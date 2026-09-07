import { createNeonAuth } from "@neondatabase/auth/next/server";

// Server-side Neon Auth (Managed Better Auth) instance — used in Server
// Components, Server Actions, Route Handlers, and the Proxy. `NEON_AUTH_BASE_URL`
// is provisioned by Neon (present in .env.local); `NEON_AUTH_COOKIE_SECRET` must
// be a 32+ char random string (openssl rand -base64 32).
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
