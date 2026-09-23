/** Operator display preferences — the per-staff density and motion choices
 * surfaced in the account panel's Display tab. Pure data: constants, types and
 * defaults shared by the Firestore store, the API route and the panel UI. */

export const displayDensities = ["comfortable", "compact"] as const;
export type DisplayDensity = (typeof displayDensities)[number];

export const displayMotions = ["full", "reduced"] as const;
export type DisplayMotion = (typeof displayMotions)[number];

export type DisplayPreferences = {
  density: DisplayDensity;
  motion: DisplayMotion;
};

export const displayDensityLabels: Record<DisplayDensity, string> = {
  comfortable: "Comfortable",
  compact: "Compact",
};

export const displayMotionLabels: Record<DisplayMotion, string> = {
  full: "Full motion",
  reduced: "Reduced motion",
};

export function defaultDisplayPreferences(): DisplayPreferences {
  return { density: "comfortable", motion: "full" };
}
