// The staff sidebar can fold down to a rail of icons. The choice belongs to
// the screen rather than the person (a laptop wants the room, a wide monitor
// does not), so it lives in a cookie on this browser, scoped to /admin. The
// layout reads it on the server so the first paint already has the right
// width and nothing jumps once the page hydrates.

export const SIDEBAR_RAIL_COOKIE = "kcpl_admin_sidebar";

export function isRailCookie(value: string | undefined) {
  return value === "rail";
}

/** The Set-Cookie text for this choice: kept a year when folded, cleared when not. */
export function sidebarRailCookie(rail: boolean, secure: boolean) {
  const value = rail ? "rail" : "";
  const age = rail ? 60 * 60 * 24 * 365 : 0;
  return `${SIDEBAR_RAIL_COOKIE}=${value}; Path=/admin; Max-Age=${age}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
