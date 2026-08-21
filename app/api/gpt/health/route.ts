import { firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;

  return gptActionJson({
    ok: true,
    service: "KCPL Custom GPT API",
    firebaseConfigured: firebaseRuntimeConfigured(),
    mode: "read_only",
  });
}
