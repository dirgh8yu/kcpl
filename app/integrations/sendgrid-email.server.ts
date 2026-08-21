const SENDGRID_MAIL_URL = "https://api.sendgrid.com/v3/mail/send";

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

type TransactionalEmailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html: string;
  category?: string;
  customArgs?: Record<string, string>;
};

export type TransactionalEmailResult = {
  provider: "sendgrid";
  messageId: string | null;
  acceptedAt: string;
  from: string;
  to: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new EmailConfigurationError(`${name} is not configured.`);
  return value;
}

function emailAddress(value: string, label: string) {
  const cleaned = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    throw new EmailConfigurationError(`${label} is not a valid email address.`);
  }
  return cleaned;
}

function errorDetail(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "SendGrid rejected the request.";
  try {
    const parsed = JSON.parse(trimmed) as { errors?: Array<{ message?: string }> };
    const messages = parsed.errors?.map((item) => item.message?.trim()).filter(Boolean) ?? [];
    if (messages.length) return messages.slice(0, 3).join("; ");
  } catch {
    // Fall through to a short plain-text response.
  }
  return trimmed.slice(0, 600);
}

export function transactionalEmailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.KCPL_EMAIL_FROM?.trim());
}

export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<TransactionalEmailResult> {
  const apiKey = requiredEnv("SENDGRID_API_KEY");
  const from = emailAddress(requiredEnv("KCPL_EMAIL_FROM"), "KCPL_EMAIL_FROM");
  const fromName = process.env.KCPL_EMAIL_FROM_NAME?.trim() || "Kapileshwor Cargo Pvt. Ltd. (KCPL)";
  const replyToValue = process.env.KCPL_EMAIL_REPLY_TO?.trim();
  const replyTo = replyToValue ? emailAddress(replyToValue, "KCPL_EMAIL_REPLY_TO") : from;
  const to = emailAddress(input.to, "Recipient email");

  const payload = {
    personalizations: [{
      to: [{ email: to, ...(input.toName?.trim() ? { name: input.toName.trim() } : {}) }],
      ...(input.customArgs ? { custom_args: input.customArgs } : {}),
    }],
    from: { email: from, name: fromName },
    reply_to: { email: replyTo },
    subject: input.subject,
    content: [
      { type: "text/plain", value: input.text },
      { type: "text/html", value: input.html },
    ],
    categories: [input.category || "kcpl-transactional"],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(SENDGRID_MAIL_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new EmailDeliveryError("SendGrid did not respond within 15 seconds.");
    }
    throw new EmailDeliveryError(error instanceof Error ? error.message : "SendGrid could not be reached.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status !== 202) {
    const body = await response.text().catch(() => "");
    throw new EmailDeliveryError(`SendGrid returned HTTP ${response.status}: ${errorDetail(body)}`);
  }

  return {
    provider: "sendgrid",
    messageId: response.headers.get("x-message-id"),
    acceptedAt: new Date().toISOString(),
    from,
    to,
  };
}
