import { env } from "cloudflare:workers";
import { ChatGPTUser, chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export type AdminAccess =
  | { kind: "signed-out"; signInPath: string }
  | { kind: "unconfigured"; user: ChatGPTUser }
  | { kind: "forbidden"; user: ChatGPTUser }
  | { kind: "authorized"; user: ChatGPTUser };

function adminEmails() {
  const value = (env as unknown as { KCPL_ADMIN_EMAILS?: string }).KCPL_ADMIN_EMAILS ?? "";
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminAccess(returnTo = "/admin"): Promise<AdminAccess> {
  const user = await getChatGPTUser();
  if (!user) return { kind: "signed-out", signInPath: chatGPTSignInPath(returnTo) };

  const allowed = adminEmails();
  if (!allowed.length) return { kind: "unconfigured", user };
  if (!allowed.includes(user.email.trim().toLowerCase())) return { kind: "forbidden", user };
  return { kind: "authorized", user };
}
