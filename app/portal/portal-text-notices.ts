/*
 * SMS and WhatsApp notices, for customers who read neither email nor an app.
 * The same facts the email and push already carry (portal-notifications),
 * shortened to a line, sent only to a number the customer gave and agreed to.
 * Pure: the rules are tested directly.
 */

export const textNoticeChannels = ["sms", "whatsapp"] as const;
export type TextNoticeChannel = (typeof textNoticeChannels)[number];

export type TextNoticeSettings = { channel: TextNoticeChannel | "none"; phone: string | null };

/**
 * A number to text. SMS goes through a Nepali gateway, so only Nepal's
 * mobile numbers (98…, 97…, 96…) are taken, as +977 and ten digits.
 * WhatsApp takes any international number.
 */
export function textNoticePhone(input: unknown, channel: TextNoticeChannel): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[\s().-]/g, "");
  const nepal = /^(?:\+?977)?(9[678]\d{8})$/.exec(digits);
  if (nepal) return `+977${nepal[1]}`;
  if (channel === "whatsapp" && /^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

/** What the customer asked for, or why it can't be saved. */
export function textNoticeSettingsFromBody(body: Record<string, unknown>):
  { ok: true; settings: TextNoticeSettings } | { ok: false; error: string } {
  const channel = body.channel;
  if (channel === "none" || channel === null || channel === undefined) return { ok: true, settings: { channel: "none", phone: null } };
  if (!textNoticeChannels.includes(channel as TextNoticeChannel)) return { ok: false, error: "Choose SMS, WhatsApp or neither." };
  const phone = textNoticePhone(body.phone, channel as TextNoticeChannel);
  if (!phone) {
    return { ok: false, error: channel === "sms" ? "Enter a Nepali mobile number (98…, 97… or 96…)." : "Enter a mobile number with its country code, such as +977 98…" };
  }
  if (body.consent !== true) return { ok: false, error: "Tick the box to agree to receive these messages." };
  return { ok: true, settings: { channel: channel as TextNoticeChannel, phone } };
}

/** The settings as stored on the portal account. */
export function storedTextNotice(record: Record<string, unknown> | undefined): TextNoticeSettings {
  const raw = record?.text_notices;
  if (!raw || typeof raw !== "object") return { channel: "none", phone: null };
  const value = raw as Record<string, unknown>;
  const channel = textNoticeChannels.includes(value.channel as TextNoticeChannel) ? (value.channel as TextNoticeChannel) : null;
  const phone = channel ? textNoticePhone(value.phone, channel) : null;
  return channel && phone ? { channel, phone } : { channel: "none", phone: null };
}

/** One SMS (160 characters, plain ASCII so it isn't split): "KCPL: …". */
export function textNoticeSms(subject: string, line: string) {
  const plain = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[·•]/g, "-").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
  const message = `KCPL: ${plain(subject)}${line ? `. ${plain(line)}` : ""}`;
  return message.length <= 160 ? message : `${message.slice(0, 157).trimEnd()}...`;
}
