// Staff should read what happened and what to do, never a browser or backend
// internal. Server routes already answer in plain words; this catches what the
// browser itself throws (a dropped connection, an empty reply) on the way to a
// notice.

const rewrites: [RegExp, string][] = [
  [/unexpected end of json input|json\.parse|unexpected token .* json|is not valid json|unexpected non-whitespace/i, "The server sent back an incomplete reply. Try again."],
  [/failed to fetch|networkerror|network error|load failed|network request failed/i, "Couldn’t reach KCPL. Check your connection and try again."],
  [/aborterror|the operation was aborted|signal is aborted/i, "The request was cancelled. Try again."],
  [/timed? ?out/i, "That took too long. Try again."],
  [/internal server error|^500\b/i, "Something went wrong on our side. Try again in a minute."],
];

export function humanErrorMessage(message: string): string {
  for (const [pattern, plain] of rewrites) if (pattern.test(message)) return plain;
  return message;
}

/** Load failures, as opposed to failed saves: reloading is the right retry.
 * (A failed save keeps its form, so pressing Save again is the retry.) */
export function isLoadFailure(message: string): boolean {
  return /didn’t load|didn't load|reload the page|isn’t responding|aren’t responding|couldn’t reach kcpl|incomplete reply/i.test(message);
}
