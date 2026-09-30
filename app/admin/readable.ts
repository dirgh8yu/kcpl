/** A stored value as a label: "general_cargo" -> "General cargo". For values
 *  shown on their own (options, facts, table cells); inside a sentence the
 *  lowercase form reads better and the caller keeps it. */
export function readable(value: string) {
  const text = value.replaceAll("_", " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}
