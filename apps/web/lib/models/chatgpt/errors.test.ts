import { mapChatgptError } from "./errors";

const body = (code: string, param?: string) => ({ error: { code, param } });

test("mapChatgptError maps the plan limit to a Manage usage action", () => {
  const e = mapChatgptError(429, body("subscription_sharing_usage_limit_exceeded"));
  expect(e).toMatchObject({
    code: "limit",
    message: "You've hit your ChatGPT plan limit.",
    action: { label: "Manage usage", href: "https://chatgpt.com/settings/usage" },
  });
});

test("mapChatgptError maps the other plan errors", () => {
  expect(mapChatgptError(403, body("subscription_sharing_user_not_eligible"))).toMatchObject({
    code: "unsupported",
    message: "This ChatGPT plan can't be used in other apps.",
  });
  expect(mapChatgptError(503, body("subscription_sharing_usage_unavailable")).code).toBe("unavailable");
  expect(mapChatgptError(400, body("subscription_sharing_unsupported_capability", "tools")).message).toContain("tools");
  expect(mapChatgptError(401, body("subscription_sharing_invalid_user"))).toMatchObject({
    code: "auth",
    action: { label: "Reconnect ChatGPT", href: "/settings/models" },
  });
});

test("mapChatgptError falls back to status mapping and reads {detail}", () => {
  expect(mapChatgptError(401, { detail: "nope" }).code).toBe("auth");
  expect(mapChatgptError(500, null).code).toBe("unavailable");
});

test("an error Grid doesn't know shows OpenAI's own message, never [object Object]", () => {
  const notFound = mapChatgptError(404, { error: { message: "Item with id 'msg_1' not found.", type: "invalid_request_error" } });
  expect(notFound.message).toBe("ChatGPT couldn't answer: Item with id 'msg_1' not found.");
  expect(mapChatgptError(404, null).message).toBe("ChatGPT couldn't answer (error 404). Try again.");
  expect(mapChatgptError(404, { detail: "Not Found" }).message).toBe("ChatGPT couldn't answer: Not Found");
});
