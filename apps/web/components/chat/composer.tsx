"use client";

import { useEffect, useRef, useState } from "react";
import type { FileUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, ChevronDown, CornerUpLeft, FileText, Loader2, Mic, Plus, Square, X } from "lucide-react";
import { ChatgptBadge } from "@/components/models/chatgpt-badge";
import { ModelPicker } from "@/components/models/model-picker";
import type { ModelRef } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";

type Pending = FileUIPart & { uploading?: boolean };

type Props = {
  botId: string;
  botName: string;
  busy: boolean;
  quote: string | null;
  onClearQuote: () => void;
  onSend: (text: string, files: FileUIPart[]) => void;
  onStop: () => void;
  model: ModelRef | null;
  modelLabel: string;
  onModelChange: (m: ModelRef | null) => void;
  chatgpt: boolean;
};

export function Composer(p: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const grow = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const upload = async (list: FileList | null) => {
    if (!list) return;
    setError(null);
    for (const file of Array.from(list)) {
      const temp: Pending = { type: "file", mediaType: file.type, url: URL.createObjectURL(file), filename: file.name, uploading: true };
      setFiles((f) => [...f, temp]);
      const form = new FormData();
      form.set("botId", p.botId);
      form.set("file", file);
      const res = await fetch("/api/files", { method: "POST", body: form, headers: { "x-grid": "1" } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "Couldn't attach that file.");
        setFiles((f) => f.filter((x) => x !== temp));
        continue;
      }
      const up = (await res.json()) as { url: string; name: string; mediaType: string };
      setFiles((f) => f.map((x) => (x === temp ? { type: "file", mediaType: up.mediaType, url: up.url, filename: up.name } : x)));
    }
    if (input.current) input.current.value = "";
  };

  const ready = files.every((f) => !f.uploading);
  const has = text.trim().length > 0 || files.length > 0;
  // Enter while a file is still uploading, or while the bot is still replying:
  // keep the message and send it the moment that finishes.
  const [queued, setQueued] = useState(false);

  const submit = () => {
    if (!has) return;
    if (!ready || p.busy) {
      setQueued(true);
      return;
    }
    setQueued(false);
    const body = p.quote ? `${p.quote.split("\n").map((l) => `> ${l}`).join("\n")}\n\n${text.trim()}` : text.trim();
    p.onSend(body, files.map(({ uploading: _u, ...f }) => f));
    setText("");
    setFiles([]);
    p.onClearQuote();
    requestAnimationFrame(grow);
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (queued && ready && !p.busy) submitRef.current();
  }, [queued, ready, p.busy]);

  return (
    <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 md:px-6 md:pb-4">
      <div className="mx-auto max-w-[680px]">
        <AnimatePresence initial={false}>
          {p.quote && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18, ease: ease.out }}
              className="mb-2 flex items-start gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text-2)] edge"
            >
              <CornerUpLeft size={14} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2 flex-1">{p.quote}</span>
              <button onClick={p.onClearQuote} aria-label="Cancel reply" className="press grid size-6 place-items-center rounded-full hover:bg-[var(--surface-2)]">
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {queued && p.busy && <p className="mb-2 px-2 text-[12.5px] text-[var(--text-3)]">Sends when {p.botName} finishes…</p>}
        {error && (
          <p role="alert" className="mb-2 text-[13px]" style={{ color: "oklch(0.6 0.2 25)" }}>
            {error}
          </p>
        )}

        <div className="rounded-[26px] bg-[var(--surface)] p-1.5 edge focus-within:shadow-[0_0_0_1.5px_var(--bot-edge)]">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1.5 pb-1.5 pt-1">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  {f.mediaType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.filename ?? "image"} className="size-14 rounded-xl object-cover edge" />
                  ) : (
                    <div className="flex h-14 items-center gap-1.5 rounded-xl bg-[var(--surface-2)] px-3 text-[12px]">
                      <FileText size={14} /> <span className="max-w-[120px] truncate">{f.filename}</span>
                    </div>
                  )}
                  {f.uploading && (
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/30 text-white">
                      <Loader2 size={16} className="animate-spin" />
                    </span>
                  )}
                  <button
                    onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.filename ?? "file"}`}
                    className="press absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--text)] text-[var(--bg)]"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <input
              ref={input}
              type="file"
              multiple
              aria-label="Attach a file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown"
              className="sr-only"
              onChange={(e) => upload(e.target.files)}
            />
            <button onClick={() => input.current?.click()} className="press hover-surface grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-2)]" aria-label="Add a file" title="Add a file">
              <Plus size={19} />
            </button>
            <textarea
              ref={ta}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                grow();
              }}
              onPaste={(e) => {
                if (e.clipboardData.files.length) {
                  e.preventDefault();
                  upload(e.clipboardData.files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={`Message ${p.botName}`}
              className="max-h-[160px] min-h-9 flex-1 resize-none bg-transparent py-[7px] text-[15px] leading-[1.45] outline-none placeholder:text-[var(--text-3)]"
            />
            <AnimatePresence mode="popLayout" initial={false}>
              {p.busy ? (
                <motion.button key="stop" {...pop} onClick={p.onStop} className="press grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]" aria-label="Stop">
                  <Square size={14} fill="currentColor" />
                </motion.button>
              ) : has ? (
                <motion.button key="send" {...pop} onClick={submit} disabled={queued} className="press grid size-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--bot)", color: "var(--bot-ink)" }} aria-label="Send">
                  {queued ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.4} />}
                </motion.button>
              ) : (
                <motion.span key="mic" {...pop} className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-3)]" title="Voice notes arrive in a later version">
                  <Mic size={18} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="relative mt-1.5 flex items-center justify-between gap-2 px-2">
          <button onClick={() => setPicker((v) => !v)} className="press hover-surface inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] text-[var(--text-3)]" aria-expanded={picker}>
            {p.modelLabel} <ChevronDown size={12} />
          </button>
          {p.chatgpt && <ChatgptBadge />}
          <AnimatePresence>
            {picker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
                transition={{ duration: 0.16, ease: ease.out }}
                style={{ transformOrigin: "bottom left" }}
                className="absolute bottom-9 left-0 z-20 w-[300px] rounded-2xl bg-[var(--surface)] p-3 edge"
              >
                <ModelPicker
                  label={`${p.botName}'s model`}
                  allowDefault
                  value={p.model}
                  onChange={(m) => {
                    p.onModelChange(m);
                    setPicker(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const pop = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.6, opacity: 0 },
  transition: spring.snappy,
};
