// How long since a visitor's last heartbeat before they read as "not here
// anymore" — well over PresenceIndicator's ~20s heartbeat interval so one
// missed beat (a slow request, a backgrounded tab) doesn't flicker someone in
// and out. Shared by the per-board presence route and the cross-board activity
// feed (/api/activity, powering Spy and Explore).
export const ACTIVE_WINDOW_SECONDS = 45;
