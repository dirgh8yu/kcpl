const tokenPattern = /^[A-Za-z0-9_-]{32}$/;

/**
 * A tracking link is the credential; we accept the whole copied link or the
 * bare 32-character token, and never a shipment reference. Extracting the
 * token in the browser is safe because the destination route still verifies
 * the token hash server-side.
 */
export function trackingTokenFromInput(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (tokenPattern.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/t\/([A-Za-z0-9_-]{32})\/?$/);
    return match?.[1] && tokenPattern.test(match[1]) ? match[1] : null;
  } catch {
    return null;
  }
}
