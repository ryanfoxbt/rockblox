// Site admin allowlist — one hardcoded email, the same person across every
// admin surface (RockBlocks Math's curriculum editor, the AI instrumental
// pilot, whatever's next). No server-only import here on purpose: an email
// address isn't a secret and `authClient.useSession()` already hands the
// client this same value, so client components can use isAdminEmail directly
// to decide what to render — the actual access boundary is always the
// server checking it again in the API route or page, never the client-side
// check alone.
const ADMIN_EMAILS = new Set(["ryanfoxbt@gmail.com"]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
