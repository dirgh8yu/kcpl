/** A route's record reference as a tab title: decoded, and cut short so a
 *  crafted URL cannot fill the tab. A reference that fails to decode is shown
 *  as it came. */
export function recordTitle(value: string) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the raw segment.
  }
  return decoded.length > 60 ? `${decoded.slice(0, 59)}…` : decoded;
}
