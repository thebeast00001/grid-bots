import { GridModelError, toGridError } from "../errors";

export const MANAGE_USAGE = { label: "Manage usage", href: "https://chatgpt.com/settings/usage" };
export const RECONNECT = { label: "Reconnect ChatGPT", href: "/settings/models" };

/** Maps ChatGPT plan-usage errors (docs: errors-and-recovery) to messages a person can act on. */
export function mapChatgptError(status: number, body: unknown): GridModelError {
  const err = (body as { error?: { code?: string; param?: string; message?: string } } | null)?.error;
  switch (err?.code) {
    case "subscription_sharing_usage_limit_exceeded":
      return new GridModelError("limit", "You've hit your ChatGPT plan limit.", { action: MANAGE_USAGE });
    case "subscription_sharing_user_not_eligible":
      return new GridModelError("unsupported", "This ChatGPT plan can't be used in other apps.");
    case "subscription_sharing_usage_unavailable":
      return new GridModelError("unavailable", "ChatGPT plan usage is unavailable right now. Try again in a moment.");
    case "subscription_sharing_unsupported_capability":
      return new GridModelError("unsupported", `The ChatGPT plan doesn't support this${err.param ? ` (${err.param})` : ""}.`);
    case "subscription_sharing_route_not_supported":
      return new GridModelError("unsupported", "The ChatGPT plan doesn't support this request.");
    case "subscription_sharing_invalid_user":
      return new GridModelError("auth", "Your ChatGPT sign-in is no longer valid.", { action: RECONNECT });
  }
  const g = toGridError({ status }, "ChatGPT");
  if (g.code === "auth") return new GridModelError("auth", "Your ChatGPT sign-in expired.", { action: RECONNECT });
  if (g.code !== "unknown") return g;
  // Anything else: say what OpenAI said, so the person (and a bug report) has something real.
  const said = err?.message ?? (body as { detail?: unknown } | null)?.detail;
  return new GridModelError(
    "unknown",
    typeof said === "string" && said.trim() ? `ChatGPT couldn't answer: ${said.trim()}` : `ChatGPT couldn't answer (error ${status}). Try again.`,
    { cause: body },
  );
}
