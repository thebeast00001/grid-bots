"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { BookmarkPlus, CornerUpLeft, FileText, Pencil, Pin, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";
import { ReminderChip, ReminderDueCard, ReminderPending, ReminderSetCard, type DueData, type Occurrence } from "@/components/reminders/reminder-card";
import { ResearchStrip } from "@/components/research/research-strip";
import { SourceChips, citeComponentsFor } from "@/components/research/source-chips";
import { citeLinks, shownSources, sourcesOf } from "@/components/research/sources";
import { RoutineChip, RoutineHeader, RoutinePending, RoutineSetCard, type RoutineData } from "@/components/routines/routine-card";
import type { ReminderView, RoutineView } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";

export const REACTIONS = ["❤️", "👍", "😂", "🔥", "👀"];

/** Messages already on screen once don't animate in again (e.g. after switching bots). */
const shown = new Set<string>();

export type RowActions = {
  onReact: (emoji: string | null) => void;
  onReply: () => void;
  onPin?: () => void;
  onRemember?: () => void;
  onEdit?: (text: string) => void;
  onRegenerate?: () => void;
};

type Props = {
  m: UIMessage;
  botId: string;
  firstOfGroup: boolean;
  lastOfGroup: boolean;
  streaming: boolean;
  animateIn: boolean;
  botReaction?: string;
  readLabel?: string;
  actions: RowActions;
};

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();

type ToolOut = { ok?: boolean; reminder?: ReminderView; routine?: RoutineView };

/** Cards for the reminder and routine tools' results and for a reminder going off. */
function ReminderParts({ m, botId, fresh }: { m: UIMessage; botId: string; fresh: boolean }) {
  const out: React.ReactNode[] = [];
  m.parts.forEach((p, i) => {
    if (p.type === "data-reminder") {
      const occurrence = (m.metadata as { reminder?: Occurrence } | undefined)?.reminder;
      out.push(<ReminderDueCard key={i} botId={botId} messageId={m.id} data={(p as { data: DueData }).data} occurrence={occurrence} fresh={fresh} />);
      return;
    }
    if (p.type === "tool-create_routine" || p.type === "tool-update_routine" || p.type === "tool-delete_routine") {
      if (!("state" in p)) return;
      if (p.state === "input-streaming" || p.state === "input-available") {
        if (p.type === "tool-create_routine") out.push(<RoutinePending key={i} />);
        return;
      }
      const res = p.state === "output-available" ? (p.output as ToolOut) : null;
      if (!res?.ok) return;
      if (p.type === "tool-create_routine" && res.routine) out.push(<RoutineSetCard key={i} botId={botId} routine={res.routine} />);
      else if (p.type === "tool-update_routine" && res.routine) out.push(<RoutineChip key={i} kind="updated" routine={res.routine} />);
      else if (p.type === "tool-delete_routine") out.push(<RoutineChip key={i} kind="deleted" />);
      return;
    }
    const kind = p.type === "tool-set_reminder" ? "set" : p.type === "tool-change_reminder" ? "changed" : p.type === "tool-cancel_reminder" ? "cancelled" : null;
    if (!kind || !("state" in p)) return;
    if (p.state === "input-streaming" || p.state === "input-available") {
      if (kind === "set") out.push(<ReminderPending key={i} />);
      return;
    }
    const result = p.state === "output-available" ? (p.output as ToolOut) : null;
    if (!result?.ok || !result.reminder) return;
    out.push(kind === "set" ? <ReminderSetCard key={i} botId={botId} reminder={result.reminder} /> : <ReminderChip key={i} kind={kind} reminder={result.reminder} />);
  });
  return out.length ? <>{out}</> : null;
}

export function MessageRow({ m, botId, firstOfGroup, lastOfGroup, streaming, animateIn, botReaction, readLabel, actions }: Props) {
  const mine = m.role === "user";
  const isNew = animateIn && !shown.has(m.id);
  useEffect(() => {
    shown.add(m.id);
  }, [m.id]);

  const [toolbar, setToolbar] = useState(false);
  const [editing, setEditing] = useState(false);
  const press = useRef<number | undefined>(undefined);
  const reaction = (m.metadata as { reaction?: string } | undefined)?.reaction;
  const files = m.parts.filter((p) => p.type === "file");
  // A reminder going off shows as its card, not as the plain "⏰ …" text kept for the model.
  const isReminder = m.parts.some((p) => p.type === "data-reminder");
  const routine = (m.parts.find((p) => p.type === "data-routine") as { data: RoutineData } | undefined)?.data;
  // Messages a bot wrote on its own (a reminder, a routine) have no reaction bar.
  const isAuto = isReminder || !!routine;
  const text = isReminder ? "" : textOf(m);
  // Research: numbered sources, citation links in the text, chips under it.
  const sources = useMemo(() => (mine ? [] : sourcesOf(m.parts)), [m.parts, mine]);
  const components = citeComponentsFor(sources);
  // Chips once there's an answer to go with them, not while the bot is still reading.
  const chips = sources.length && text ? shownSources(sources, text) : [];
  const fine = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.snappy}
      style={{ transformOrigin: mine ? "bottom right" : "bottom left" }}
      className={`group flex flex-col ${mine ? "items-end" : "items-start"} ${firstOfGroup ? "mt-4" : "mt-1"}`}
    >
      <div
        data-testid={mine ? "user-message" : "bot-message"}
        className="relative max-w-[82%]"
        onPointerEnter={() => fine && setToolbar(true)}
        onPointerLeave={() => fine && setToolbar(false)}
        onPointerDown={() => {
          if (fine) return;
          press.current = window.setTimeout(() => setToolbar(true), 420);
        }}
        onPointerUp={() => clearTimeout(press.current)}
        onPointerCancel={() => clearTimeout(press.current)}
      >
        <AnimatePresence>
          {toolbar && !editing && !streaming && !isAuto && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: ease.out }}
              style={{ transformOrigin: mine ? "bottom right" : "bottom left" }}
              className={`absolute -top-11 z-10 flex items-center gap-0.5 rounded-full bg-[var(--surface)] p-1 edge ${mine ? "right-0" : "left-0"}`}
            >
              {!mine &&
                REACTIONS.map((e) => (
                  <button
                    key={e}
                    aria-label={`React ${e}`}
                    onClick={() => {
                      actions.onReact(reaction === e ? null : e);
                      setToolbar(false);
                    }}
                    className="press grid size-8 place-items-center rounded-full text-[16px] hover:bg-[var(--surface-2)]"
                    style={{ background: reaction === e ? "var(--surface-3)" : undefined }}
                  >
                    {e}
                  </button>
                ))}
              {!mine && <span className="mx-0.5 h-5 w-px bg-[var(--edge-strong)]" />}
              <ToolButton label="Reply" onClick={actions.onReply}>
                <CornerUpLeft size={15} />
              </ToolButton>
              {actions.onRemember && (
                <ToolButton label="Remember this" onClick={() => { actions.onRemember?.(); setToolbar(false); }}>
                  <BookmarkPlus size={15} />
                </ToolButton>
              )}
              {actions.onPin && (
                <ToolButton label="Pin as instruction" onClick={actions.onPin}>
                  <Pin size={15} />
                </ToolButton>
              )}
              {actions.onEdit && (
                <ToolButton label="Edit" onClick={() => setEditing(true)}>
                  <Pencil size={15} />
                </ToolButton>
              )}
              {actions.onRegenerate && (
                <ToolButton label="Regenerate" onClick={actions.onRegenerate}>
                  <RotateCcw size={15} />
                </ToolButton>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <div className={`mb-1 flex flex-wrap gap-1.5 ${mine ? "justify-end" : ""}`}>
            {files.map((f, i) =>
              f.mediaType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={f.url} alt={f.filename ?? "image"} className="max-h-60 max-w-[240px] rounded-2xl object-cover edge" />
              ) : (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2 text-[13px] edge">
                  <FileText size={16} /> {f.filename ?? "file"}
                </a>
              ),
            )}
          </div>
        )}

        {routine && <RoutineHeader botId={botId} data={routine} />}

        {!mine && <ResearchStrip parts={m.parts} answered={!!text} />}

        {editing ? (
          <EditBox
            initial={text}
            onCancel={() => setEditing(false)}
            onSave={(t) => {
              setEditing(false);
              actions.onEdit?.(t);
            }}
          />
        ) : (
          text && (
            <div
              className={`rounded-[20px] px-3.5 py-2 text-[15px] leading-[1.45] ${mine ? "whitespace-pre-wrap" : "bot-md bg-[var(--surface-2)]"}`}
              style={
                mine
                  ? { background: "var(--bot)", color: "var(--bot-ink)", borderBottomRightRadius: lastOfGroup ? 6 : 20 }
                  : { borderBottomLeftRadius: lastOfGroup ? 6 : 20 }
              }
            >
              {mine ? (
                text
              ) : (
                <Streamdown animated={{ animation: "blurIn", duration: 160 }} isAnimating={streaming} components={components}>
                  {sources.length ? citeLinks(text, sources) : text}
                </Streamdown>
              )}
            </div>
          )
        )}

        {!mine && !editing && <SourceChips sources={chips} />}

        {!mine && <ReminderParts m={m} botId={botId} fresh={isNew} />}

        <AnimatePresence>
          {(mine ? botReaction : reaction) && (
            <motion.span
              key={mine ? botReaction : reaction}
              data-testid="reaction"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.45 }}
              className={`absolute -bottom-3 ${mine ? "-left-2" : "-right-2"} grid h-6 min-w-6 place-items-center rounded-full bg-[var(--surface)] px-1 text-[13px] edge`}
            >
              {mine ? botReaction : reaction}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {readLabel && <div className="mt-1 pr-1 text-[11.5px] text-[var(--text-3)]">{readLabel}</div>}
    </motion.div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="press grid size-8 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)]">
      {children}
    </button>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="field w-[min(480px,80vw)] rounded-[20px] bg-[var(--surface)] p-2 edge">
      <textarea
        aria-label="Edit message"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            onSave(value.trim());
          }
        }}
        rows={Math.min(6, Math.max(2, value.split("\n").length))}
        className="w-full resize-none bg-transparent px-2 py-1 text-[15px] outline-none"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="press hover-surface rounded-full px-3 py-1.5 text-[13px] text-[var(--text-2)]">
          Cancel
        </button>
        <button
          onClick={() => value.trim() && onSave(value.trim())}
          className="press rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
          style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
