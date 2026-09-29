// Staff type times in Nepal time (NPT, UTC+05:45) into datetime-local inputs.

/** "2026-09-30T14:30" typed in Nepal → ISO instant, or "" when incomplete. */
export function nepalInputToIso(value: string) {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/.exec(value);
  if (!match) return "";
  const parsed = new Date(`${match[1]}:00+05:45`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** An instant as "30 Sept 2026, 2:30 pm NPT". */
export function nepalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}
