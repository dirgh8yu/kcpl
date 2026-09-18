// Client half of the quote-form attestation.
//
// Invisible mode on purpose: the widget renders no visible box, so the enquiry
// form's layout — which is designed and reviewed separately from this — does not
// change. Nothing is loaded at all until a submission is attempted, and nothing
// is loaded when no site key is configured, so the page pays no third-party cost
// in the default state and keeps working if Turnstile is unavailable.

const SCRIPT_ID = "kcpl-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CONTAINER_ID = "kcpl-turnstile-container";

export type TurnstileApi = {
  render(
    target: string | HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      size: "invisible";
      action?: string;
    },
  ): string;
  execute(widgetId: string, options?: { action?: string }): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function turnstileSiteKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const key = env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

function ensureContainer(): HTMLElement {
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) return existing;
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.setAttribute("aria-hidden", "true");
  // Off-screen rather than display:none, because the widget has to lay out to
  // run; this keeps it out of the page's visual flow entirely.
  container.style.position = "absolute";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  document.body.appendChild(container);
  return container;
}

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile did not initialise."));
    });
    script.addEventListener("error", () => reject(new Error("Turnstile could not be loaded.")));
  });
}

/**
 * Resolves with a challenge token, or throws if the challenge cannot be
 * satisfied. Callers surface the failure rather than submitting unattested,
 * because the server refuses an unattested submission whenever it is configured
 * to check one.
 */
export async function requestChallengeToken(siteKey: string): Promise<string> {
  const api = await loadScript();
  const container = ensureContainer();

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null;
    const settle = (token: string) => {
      if (widgetId) api.remove(widgetId);
      resolve(token);
    };
    const fail = () => {
      if (widgetId) api.remove(widgetId);
      reject(new Error("KCPL could not verify this browser. Please try again, or email us directly."));
    };

    widgetId = api.render(container, {
      sitekey: siteKey,
      callback: settle,
      "error-callback": fail,
      size: "invisible",
      action: "quote",
    });
    api.execute(widgetId, { action: "quote" });
  });
}
