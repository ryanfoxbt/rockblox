import { auth } from "@/lib/auth/server";

// Next.js 16 renamed Middleware to the Proxy convention (see AGENTS.md). Neon
// Auth guards the routes in `matcher` — anonymous visitors to /my/* are bounced
// to the sign-in page. Everything else on the site stays public and anonymous.
export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: ["/my/:path*", "/spy", "/spy/:path*", "/explore", "/explore/:path*"],
};
