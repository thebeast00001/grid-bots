import { toUIMessageStream, type ToolSet, type UIMessage } from "ai";
import { toGridError } from "../models/errors";

/** Stream errors go to the chat as `{code,message,action}` JSON so the UI can offer the right fix. */
export const errorText = (e: unknown) => JSON.stringify(toGridError(e).toJSON());

/** A reply stream for the chat UI (and for saving the reply), with one id for the reply message. */
export function chatUIStream(o: {
  stream: Parameters<typeof toUIMessageStream>[0]["stream"];
  tools?: ToolSet;
  originalMessages: UIMessage[];
  messageId: string;
  onError?: (e: unknown) => string;
  onEnd?: (e: { messages: UIMessage[] }) => void | Promise<void>;
}) {
  return toUIMessageStream({
    stream: o.stream,
    tools: o.tools,
    originalMessages: o.originalMessages,
    generateMessageId: () => o.messageId,
    onError: o.onError ?? errorText,
    // A failed tool keeps the error text the model received. Otherwise the saved history says
    // something different from what the model was told, and models that bind their reasoning
    // to earlier messages (e.g. Claude with preserved thinking) reject it.
    redactToolErrors: false,
    onEnd: o.onEnd,
  });
}
