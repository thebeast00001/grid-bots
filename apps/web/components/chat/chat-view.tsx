"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useBots } from "@/components/shell/bots-store";
import { api } from "@/lib/api-client";
import { setBotStatus } from "@/lib/bot-status-store";
import type { BotView, ModelRef, ProviderView } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";
import { Composer } from "./composer";
import { deriveStatus, parseChatError } from "./derive-status";
import { MessageRow } from "./message-row";
import { Presence } from "./presence";

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();

/** Bot reactions: saved ones come from metadata, live ones from the react tool in the reply. */
function botReactions(messages: UIMessage[]): Map<string, string> {
  const out = new Map<string, string>();
  messages.forEach((m, i) => {
    const saved = (m.metadata as { botReaction?: string } | undefined)?.botReaction;
    if (m.role === "user" && saved) out.set(m.id, saved);
    if (m.role !== "assistant") return;
    for (const part of m.parts) {
      if (part.type === "tool-react" && "input" in part) {
        const emoji = (part.input as { emoji?: string } | undefined)?.emoji;
        const prevUser = [...messages.slice(0, i)].reverse().find((x) => x.role === "user");
        if (emoji && prevUser) out.set(prevUser.id, emoji);
      }
    }
  });
  return out;
}

export function ChatView({ bot, initial, mobile = false }: { bot: BotView; initial: UIMessage[]; mobile?: boolean }) {
  const { upsert, refresh } = useBots();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { "x-grid": "1" },
        prepareSendMessagesRequest: ({ messages, trigger }) => ({ body: { botId: bot.id, message: messages.at(-1), trigger } }),
      }),
    [bot.id],
  );
  const { messages, setMessages, sendMessage, regenerate, status, error, clearError, stop } = useChat({ id: bot.id, messages: initial, transport });

  // ── status → the bot's face, here and in the list ─────────────────
  const [justFinished, setJustFinished] = useState(false);
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") {
      setJustFinished(true);
      // Update the list's last-message preview and ordering.
      void refresh().catch(() => {});
      const t = window.setTimeout(() => setJustFinished(false), 1200);
      prevStatus.current = status;
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]);
  const chatError = error ? parseChatError(error) : null;
  const derived = deriveStatus({ chat: status, last: messages.at(-1), error: chatError, justFinished });
  useEffect(() => setBotStatus(bot.id, derived), [bot.id, derived.pose, derived.text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setBotStatus(bot.id, { pose: "idle", text: "" }), [bot.id]);

  // ── which provider is answering (for the ChatGPT badge and model chip) ─
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [defaultModel, setDefaultModel] = useState<ModelRef | null>(null);
  useEffect(() => {
    api<{ providers: ProviderView[] }>("/api/providers").then((r) => setProviders(r.providers)).catch(() => {});
    api<{ defaultModel: ModelRef | null }>("/api/settings").then((r) => setDefaultModel(r.defaultModel)).catch(() => {});
  }, []);
  const effective = bot.model ?? defaultModel;
  const kind = providers.find((p) => p.id === effective?.providerId)?.kind;
  const modelLabel = bot.model ? bot.model.modelId : defaultModel ? `Default · ${defaultModel.modelId}` : "No model";

  // ── scrolling: stick to the bottom unless the reader scrolled up ───
  const scroller = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const lastLen = useRef(messages.length);
  const [unseen, setUnseen] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (stuck.current) el.scrollTop = el.scrollHeight;
    else if (messages.length > lastLen.current) setUnseen((n) => n + messages.length - lastLen.current);
    lastLen.current = messages.length;
  }, [messages]);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (stuck.current) setUnseen(0);
  };

  const [quote, setQuote] = useState<string | null>(null);
  const busy = status === "submitted" || status === "streaming";
  const reactions = botReactions(messages);
  const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
  const lastBotIdx = messages.findLastIndex((m) => m.role === "assistant");
  const answered = lastUserIdx >= 0 && (lastBotIdx > lastUserIdx || status === "streaming");

  const send = (text: string, files: UIMessage["parts"]) => {
    clearError();
    stuck.current = true;
    void sendMessage(files.length ? { text, files: files as never } : { text });
  };

  const react = async (m: UIMessage, emoji: string | null) => {
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, metadata: { ...(x.metadata as object), reaction: emoji ?? undefined } } : x)));
    await api(`/api/messages/${m.id}`, { method: "PATCH", body: JSON.stringify({ reaction: emoji }) }).catch(() => toast("Couldn't save the reaction."));
  };

  const pin = async (m: UIMessage) => {
    const text = textOf(m);
    if (!text) return;
    try {
      upsert(await api<BotView>(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ instructions: [...bot.instructions, text].slice(-30) }) }));
      toast("Pinned as a standing instruction");
    } catch {
      toast("Couldn't pin that.");
    }
  };

  const setModel = async (model: ModelRef | null) => {
    upsert(await api<BotView>(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ model }) }));
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Presence bot={bot} status={derived} size={mobile ? 76 : 92} />

        <div ref={scroller} onScroll={onScroll} className="fade-top thin-scroll absolute inset-0 overflow-y-auto px-3 pb-4 md:px-6" style={{ paddingTop: mobile ? 156 : 178 }}>
          <div className="mx-auto flex max-w-[680px] flex-col">
            {messages.length === 0 && <div className="py-10 text-center text-[13px] text-[var(--text-3)]">Say hi to {bot.name}.</div>}
            {messages.map((m, i) => {
              const mine = m.role === "user";
              const read = i === lastUserIdx && answered;
              const readAt = (m.metadata as { readAt?: string } | undefined)?.readAt;
              return (
                <MessageRow
                  key={m.id}
                  m={m}
                  firstOfGroup={messages[i - 1]?.role !== m.role}
                  lastOfGroup={messages[i + 1]?.role !== m.role}
                  streaming={status === "streaming" && i === messages.length - 1 && !mine}
                  animateIn={i >= initial.length}
                  botReaction={reactions.get(m.id)}
                  readLabel={read ? (readAt ? `Read ${new Date(readAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Read") : undefined}
                  actions={{
                    onReact: (e) => react(m, e),
                    onReply: () => setQuote(textOf(m).slice(0, 280)),
                    onPin: mine ? () => pin(m) : undefined,
                    onEdit: mine && !busy ? (text) => void sendMessage({ text, messageId: m.id }) : undefined,
                    onRegenerate: !mine && i === lastBotIdx && !busy ? () => void regenerate() : undefined,
                  }}
                />
              );
            })}

            <AnimatePresence>
              {chatError && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="mt-4 flex items-center gap-3 self-start rounded-[20px] bg-[var(--surface)] px-4 py-3 text-[14px] edge"
                >
                  <span className="text-[var(--text)]">{chatError.message}</span>
                  {chatError.action &&
                    (chatError.action.href.startsWith("http") ? (
                      <a href={chatError.action.href} target="_blank" rel="noreferrer" className="press shrink-0 rounded-full bg-[var(--text)] px-3 py-1.5 text-[13px] font-semibold text-[var(--bg)]">
                        {chatError.action.label}
                      </a>
                    ) : (
                      <Link href={chatError.action.href} className="press shrink-0 rounded-full bg-[var(--text)] px-3 py-1.5 text-[13px] font-semibold text-[var(--bg)]">
                        {chatError.action.label}
                      </Link>
                    ))}
                  {!chatError.action && (
                    <button
                      onClick={() => {
                        clearError();
                        void regenerate();
                      }}
                      className="press inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[13px] font-medium"
                    >
                      <RotateCcw size={13} /> Retry
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {unseen > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={spring.snappy}
              onClick={() => {
                scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
                stuck.current = true;
                setUnseen(0);
              }}
              className="press absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium edge"
            >
              <ArrowDown size={13} /> {unseen} new
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <Composer
        botId={bot.id}
        botName={bot.name}
        busy={busy}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        onSend={send}
        onStop={() => void stop()}
        model={bot.model}
        modelLabel={modelLabel}
        onModelChange={setModel}
        chatgpt={kind === "chatgpt"}
      />
    </div>
  );
}
