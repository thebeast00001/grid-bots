import type { UIMessage } from "ai";
import { deriveStatus, parseChatError } from "./derive-status";

const assistant = (parts: UIMessage["parts"]): UIMessage => ({ id: "a", role: "assistant", parts });

test("deriveStatus maps chat states to poses", () => {
  expect(deriveStatus({ chat: "submitted", justFinished: false })).toEqual({ pose: "thinking", text: "Thinking…" });
  expect(deriveStatus({ chat: "streaming", last: assistant([{ type: "text", text: "hi" }]), justFinished: false })).toEqual({ pose: "talking", text: "" });
  expect(deriveStatus({ chat: "error", error: { code: "network", message: "Can't reach Ollama." }, justFinished: false })).toEqual({
    pose: "stuck",
    text: "Can't reach Ollama.",
  });
  expect(deriveStatus({ chat: "ready", justFinished: true })).toEqual({ pose: "happy", text: "" });
  expect(deriveStatus({ chat: "ready", justFinished: false })).toEqual({ pose: "idle", text: "" });
});

test("deriveStatus shows Remembering… while the remember tool runs", () => {
  const last = assistant([{ type: "tool-remember", toolCallId: "c", state: "input-available", input: { text: "x", about: "user" } }] as UIMessage["parts"]);
  expect(deriveStatus({ chat: "streaming", last, justFinished: false })).toEqual({ pose: "working", text: "Remembering…" });
});

test("parseChatError reads the server's JSON in either shape", () => {
  expect(parseChatError(new Error('{"error":{"code":"no-model","message":"Connect a model to start chatting.","action":{"label":"Connect a model","href":"/welcome"}}}'))).toEqual({
    code: "no-model",
    message: "Connect a model to start chatting.",
    action: { label: "Connect a model", href: "/welcome" },
  });
  expect(parseChatError(new Error('{"code":"limit","message":"You\'ve hit your ChatGPT plan limit."}'))).toMatchObject({ code: "limit" });
  expect(parseChatError(new Error("Failed to fetch"))).toEqual({ code: "unknown", message: "Failed to fetch" });
});
