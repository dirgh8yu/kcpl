/*
 * One name per transport mode across the staff app. Quotes arrive with the
 * website's words ("ocean"), shipments and transport orders with the system's
 * ("sea"); both read "Sea freight".
 */
const freightModeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  ocean: "Sea freight",
  road: "Road freight",
  rail: "Rail freight",
  courier: "Courier",
  multimodal: "Multimodal",
  unsure: "Mode not decided",
};

export function freightModeLabel(mode: string | null | undefined) {
  const key = (mode ?? "").trim().toLowerCase();
  if (!key) return "Mode not set";
  return freightModeLabels[key] ?? `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}
