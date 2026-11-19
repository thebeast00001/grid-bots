"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, PanelRight, RotateCcw, Sparkles } from "lucide-react";
import { Sheet } from "@/components/shell/sheet";
import { toast } from "sonner";
import { MemoryList } from "@/components/profile/memory-list";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { useBots } from "@/components/shell/bots-store";
import { api } from "@/lib/api-client";
import { setBotStatus, type BotStatus } from "@/lib/bot-status-store";
import type { BotView, ModelRef, ProviderView } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";
import { Composer } from "./composer";
import { deriveStatus, parseChatError } from "./derive-status";
import { MessageRow } from "./message-row";
import { Presence } from "./presence";

/** Hidden opener that starts a new bot's interview (see app/api/chat). */
const START = "[[start]]";
const QUESTIONS = 5;

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
const isOpener = (m: UIMessage) => m.role === "user" && textOf(m).startsWith(START);

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

/** The "wrote their soul" card, anchored after the message that was last when it happened. */
type SoulNote = { kind: "wrote" | "starter"; after: string | null } | null;

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
  const visible = useMemo(() => messages.filter((m) => !isOpener(m)), [messages]);

  // ── the interview ─────────────────────────────────────────────────
  const interviewing = bot.interview === "pending";
  const answered = visible.filter((m) => m.role === "user").length;
  const [writing, setWriting] = useState(false);
  const [soulNote, setSoulNote] = useState<SoulNote>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // Bumped when memories may have changed, so an open memory list reloads.
  const [memoryVersion, setMemoryVersion] = useState(0);

  // A brand-new bot speaks first. A timer the cleanup cancels (rather than sending straight
  // from the effect) survives React's dev-mode mount → unmount → mount without sending twice
  // or having the first request aborted by the throwaway unmount.
  const greeted = useRef(false);
  useEffect(() => {
    if (!interviewing || initial.length > 0 || greeted.current) return;
    const t = window.setTimeout(() => {
      greeted.current = true;
      void sendMessage({ text: START });
    }, 30);
    return () => clearTimeout(t);
  }, [interviewing, initial.length, sendMessage]);

  const finishInterview = async (skip: boolean) => {
    if (writing) return;
    setWriting(true);
    const after = visible.at(-1)?.id ?? null;
    try {
      upsert(await api<BotView>(`/api/bots/${bot.id}/soul`, { method: "POST", body: JSON.stringify({ skip }) }));
      setSoulNote({ kind: skip ? "starter" : "wrote", after });
    } catch {
      toast(`${bot.name} couldn't write their soul. Try again from the profile.`);
    } finally {
      setWriting(false);
    }
  };

  // ── status → the bot's face, here and in the list ─────────────────
  const [justFinished, setJustFinished] = useState(false);
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") {
      setJustFinished(true);
      // Update the list's last-message preview and ordering, and any memories the bot saved.
      void refresh().catch(() => {});
      setMemoryVersion((v) => v + 1);
      if (interviewing && answered >= QUESTIONS) void finishInterview(false);
      const t = window.setTimeout(() => setJustFinished(false), 1200);
      prevStatus.current = status;
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const chatError = error ? parseChatError(error) : null;
  const derived: BotStatus = writing
    ? { pose: "working", text: "Writing my soul…" }
    : deriveStatus({ chat: status, last: messages.at(-1), error: chatError, justFinished });
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
  // Rendered after the message that was last when the soul was written (see SoulNote).
  const soulCard = () =>
    soulNote && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring.smooth}
        className="my-5 flex items-center gap-3 self-center rounded-[20px] bg-[var(--surface)] py-2.5 pl-3 pr-2 text-[14px] edge"
      >
        <Sparkles size={16} style={{ color: "var(--bot-strong)" }} />
        <span>{soulNote.kind === "wrote" ? `${bot.name} wrote their soul` : `${bot.name} wrote a starter soul`}</span>
        <button
          onClick={() => setPanelOpen(true)}
          className="press rounded-full px-3 py-1.5 text-[13px] font-semibold"
          style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
        >
          View soul
        </button>
      </motion.div>
    );

  const lastLen = useRef(visible.length);
  const [unseen, setUnseen] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (stuck.current) el.scrollTop = el.scrollHeight;
    else if (visible.length > lastLen.current) setUnseen((n) => n + visible.length - lastLen.current);
    lastLen.current = visible.length;
  }, [visible, soulNote]);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (stuck.current) setUnseen(0);
  };

  const [quote, setQuote] = useState<string | null>(null);
  const busy = status === "submitted" || status === "streaming" || writing;
  const reactions = botReactions(visible);
  const lastUserIdx = visible.findLastIndex((m) => m.role === "user");
  const lastBotIdx = visible.findLastIndex((m) => m.role === "assistant");
  const seen = lastUserIdx >= 0 && (lastBotIdx > lastUserIdx || status === "streaming");
  const firstNew = initial.filter((m) => !isOpener(m)).length;

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

  const remember = async (m: UIMessage) => {
    const text = textOf(m);
    if (!text) return;
    try {
      await api("/api/memories", { method: "POST", body: JSON.stringify({ botId: null, text: text.slice(0, 1000), sourceMessageId: m.id }) });
      setMemoryVersion((v) => v + 1);
      toast(`Saved to what ${bot.name} knows about you`);
    } catch {
      toast("Couldn't save that.");
    }
  };

  const setModel = async (model: ModelRef | null) => {
    upsert(await api<BotView>(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ model }) }));
  };

  const subtitle = interviewing ? `Getting to know you · ${Math.min(answered, QUESTIONS)}/${QUESTIONS}` : undefined;

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {mobile && (
            <Link
              href="/bots"
              aria-label="Back"
              className="press absolute left-3 top-3 z-20 grid size-10 place-items-center rounded-full backdrop-blur-xl edge"
              style={{ background: "color-mix(in oklch, var(--surface) 80%, transparent)" }}
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div className="absolute right-3 top-3 z-20 md:right-4">
            <button
              onClick={() => setPanelOpen((o) => !o)}
              aria-label="Profile"
              aria-pressed={panelOpen}
              title="Profile"
              className="press grid size-10 place-items-center rounded-full backdrop-blur-xl edge"
              style={{ background: panelOpen ? "var(--surface-3)" : "color-mix(in oklch, var(--surface) 80%, transparent)" }}
            >
              <PanelRight size={17} />
            </button>
          </div>

          <Presence bot={bot} status={derived} size={mobile ? 76 : 92} subtitle={subtitle} />
          {interviewing && !writing && (
            <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center" style={{ top: mobile ? 128 : 150 }}>
              <button onClick={() => finishInterview(true)} className="press pointer-events-auto rounded-full px-2 py-0.5 text-[12px] text-[var(--text-3)] underline-offset-2 hover:underline">
                Skip interview
              </button>
            </div>
          )}

          <div ref={scroller} onScroll={onScroll} className="fade-top thin-scroll absolute inset-0 overflow-y-auto px-3 pb-4 md:px-6" style={{ paddingTop: mobile ? 156 : 178 }}>
            <div className="mx-auto flex max-w-[680px] flex-col">
              {visible.length === 0 && !interviewing && <div className="py-10 text-center text-[13px] text-[var(--text-3)]">Say hi to {bot.name}.</div>}
              {soulNote?.after === null && soulCard()}
              {visible.map((m, i) => {
                const mine = m.role === "user";
                const readAt = (m.metadata as { readAt?: string } | undefined)?.readAt;
                return (
                  <Fragment key={m.id}>
                    <MessageRow
                      m={m}
                      firstOfGroup={visible[i - 1]?.role !== m.role}
                      lastOfGroup={visible[i + 1]?.role !== m.role}
                      streaming={status === "streaming" && i === visible.length - 1 && !mine}
                      animateIn={i >= firstNew}
                      botReaction={reactions.get(m.id)}
                      readLabel={i === lastUserIdx && seen ? (readAt ? `Read ${new Date(readAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Read") : undefined}
                      actions={{
                        onReact: (e) => react(m, e),
                        onReply: () => setQuote(textOf(m).slice(0, 280)),
                        onPin: mine ? () => pin(m) : undefined,
                        onRemember: mine ? () => remember(m) : undefined,
                        onEdit: mine && !busy ? (text) => void sendMessage({ text, messageId: m.id }) : undefined,
                        onRegenerate: !mine && i === lastBotIdx && !busy ? () => void regenerate() : undefined,
                      }}
                    />
                    {soulNote?.after === m.id && soulCard()}
                  </Fragment>
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

      {mobile && (
        <AnimatePresence>
          {panelOpen && (
            <Sheet label={`${bot.name}'s profile`} onClose={() => setPanelOpen(false)}>
              <ProfilePanel bot={bot} onClose={() => setPanelOpen(false)}>
                <MemoryList bot={bot} version={memoryVersion} />
              </ProfilePanel>
            </Sheet>
          )}
        </AnimatePresence>
      )}

      {panelOpen && !mobile && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: ease.out }}
          className="edge-l w-[320px] shrink-0 bg-[var(--panel)] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30"
        >
          <ProfilePanel bot={bot} onClose={() => setPanelOpen(false)}>
            <MemoryList bot={bot} version={memoryVersion} />
          </ProfilePanel>
        </motion.div>
      )}
    </div>
  );
}
