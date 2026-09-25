export type PortalSignInProvider = "google" | "apple";

export const portalSignInProviderNames: Record<PortalSignInProvider, string> = { google: "Google", apple: "Apple" };

/**
 * Which one-tap providers the customer portal offers, from
 * NEXT_PUBLIC_KCPL_SIGN_IN_PROVIDERS ("google", "google,apple"), Apple first
 * as its guidelines ask when both are shown. Each must also be enabled in
 * Firebase Authentication; Apple additionally needs an Apple Developer
 * Services ID. Anything else in the value is ignored.
 */
export function portalSignInProviders(value = process.env.NEXT_PUBLIC_KCPL_SIGN_IN_PROVIDERS ?? ""): PortalSignInProvider[] {
  const wanted = value.split(",").map((part) => part.trim().toLowerCase());
  return (["apple", "google"] as const).filter((provider) => wanted.includes(provider));
}
