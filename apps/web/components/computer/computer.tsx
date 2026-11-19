"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, FileText, ListChecks, Lock, Search, Sparkles, TriangleAlert, X } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import type { BotView } from "@/lib/client-types";
import { ease } from "@/lib/motion";
import type { Screen } from "./screen";

type Size = "small" | "large";

/** The bot's computer as a small live display; click to see it large. */
export function Computer({ bot, screen }: { bot: BotView; screen: Screen }) {
  const [big, setBig] = useState(false);
  const live = screen.app !== "desktop";
  return (
    <>
      <button data-testid="screen" onClick={() => setBig(true)} title={`See ${bot.name}'s screen`} className="press block w-full text-left">
        <Display bot={bot} screen={screen} size="small" />
      </button>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
        {live && <span aria-hidden className="size-1.5 rounded-full" style={{ background: "var(--bot)" }} />}
        {bot.name}&apos;s screen{live ? " · live" : ""}
      </div>
      <AnimatePresence>{big && <Expanded bot={bot} screen={screen} onClose={() => setBig(false)} />}</AnimatePresence>
    </>
  );
}

function Expanded({ bot, screen, onClose }: { bot: BotView; screen: Screen; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: ease.out }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-[6px]"
      style={{ background: "color-mix(in oklch, var(--bg) 72%, transparent)" }}
    >
      <motion.div
        role="dialog"
        aria-modal
        aria-label={`${bot.name}'s screen`}
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, transition: { duration: 0.12 } }}
        transition={{ type: "spring", duration: 0.38, bounce: 0.12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(960px,100%)]"
      >
        <div className="mb-2 flex items-center gap-2 px-1">
          <Critter cfg={bot.avatar} size={22} label="" animated={false} />
          <span className="flex-1 text-[14px] font-semibold">{bot.name}&apos;s screen</span>
          <button ref={close} onClick={onClose} aria-label="Close screen" className="press hover-surface grid size-8 place-items-center rounded-lg text-[var(--text-2)]">
            <X size={16} />
          </button>
        </div>
        <Display bot={bot} screen={screen} size="large" />
      </motion.div>
    </motion.div>
  );
}

/** One "monitor": the app that's open, crossfading when it changes. */
function Display({ bot, screen, size }: { bot: BotView; screen: Screen; size: Size }) {
  const key = screen.app === "browser" ? `browser:${screen.url}` : screen.app === "search" ? `search:${screen.query}` : screen.app;
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-[var(--bg)] edge">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.22, ease: ease.out }}
          className="absolute inset-0"
        >
          <App bot={bot} screen={screen} size={size} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const t = (size: Size, small: string, large: string) => (size === "small" ? small : large);

function Window({ size, address, icon, loading, children }: { size: Size; address: string; icon?: React.ReactNode; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className={`flex shrink-0 items-center gap-2 border-b border-[var(--edge)] bg-[var(--surface)] ${t(size, "h-6 px-2", "h-10 px-3")}`}>
        <span aria-hidden className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`rounded-full bg-[var(--surface-3)] ${t(size, "size-1.5", "size-2.5")}`} />
          ))}
        </span>
        <span className={`flex min-w-0 flex-1 items-center gap-1 rounded-full bg-[var(--surface-2)] text-[var(--text-2)] ${t(size, "h-4 px-2 text-[9px]", "h-7 px-3 text-[13px]")}`}>
          {icon}
          <span className="truncate">{address}</span>
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {loading && (
          <div aria-hidden className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
            <div className="screen-bar h-full w-1/3" style={{ background: "var(--bot)" }} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function App({ bot, screen, size }: { bot: BotView; screen: Screen; size: Size }) {
  const pad = t(size, "p-2.5", "p-6");
  const body = t(size, "text-[9.5px] leading-[1.45]", "text-[14px] leading-[1.6]");
  const head = t(size, "text-[11px]", "text-[19px]");
  const ic = size === "small" ? 9 : 14;

  if (screen.app === "desktop" || screen.app === "thinking") {
    const thinking = screen.app === "thinking";
    return (
      <div className="dotgrid grid h-full place-items-center">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Critter cfg={bot.avatar} size={size === "small" ? 46 : 110} pose={thinking ? "thinking" : "asleep"} label="" />
          <div className={`font-semibold ${head}`}>{thinking ? "Thinking…" : "Idle"}</div>
          {!thinking && screen.last && <div className={`max-w-[90%] text-[var(--text-2)] ${body}`}>Last: {screen.last}</div>}
        </div>
      </div>
    );
  }

  if (screen.app === "search") {
    return (
      <Window size={size} address={`Search · ${screen.query}`} icon={<Search size={ic} className="shrink-0" />} loading={screen.state === "running"}>
        <div className={pad}>
          {screen.state === "failed" ? (
            <Problem size={size} text={screen.error ?? "The search didn't work."} />
          ) : screen.results.length === 0 ? (
            <Skeleton size={size} rows={4} />
          ) : (
            <ul className={`flex flex-col ${t(size, "gap-1.5", "gap-3")}`}>
              {screen.results.slice(0, size === "small" ? 5 : 8).map((r, i) => (
                <motion.li key={r.url} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.2, ease: ease.out }} className="min-w-0">
                  <div className={`truncate font-medium ${t(size, "text-[10px]", "text-[15px]")}`} style={{ color: "var(--bot-strong, var(--text))" }}>
                    {r.title}
                  </div>
                  <div className={`truncate text-[var(--text-3)] ${t(size, "text-[8.5px]", "text-[12.5px]")}`}>{r.site}</div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </Window>
    );
  }

  if (screen.app === "browser") {
    return (
      <Window size={size} address={screen.site} icon={<Lock size={ic} className="shrink-0" />} loading={screen.state === "loading"}>
        <div className={`relative h-full ${pad}`}>
          {screen.state === "failed" ? (
            <Problem size={size} text={screen.error ?? "The page couldn't be read."} />
          ) : screen.state === "loading" ? (
            <>
              <div className={`mb-2 text-[var(--text-2)] ${body}`}>Reading {screen.site}</div>
              <Skeleton size={size} rows={6} />
            </>
          ) : (
            <>
              {/* The part being read: a soft band that moves down the page. */}
              <div aria-hidden className="screen-scan pointer-events-none absolute inset-x-0 top-0 h-[22%]" style={{ background: "color-mix(in oklch, var(--bot) 12%, transparent)" }} />
              <div className={`relative mb-1.5 font-semibold ${head} line-clamp-2`}>{screen.title ?? screen.site}</div>
              <div className={`relative flex flex-col ${t(size, "gap-1", "gap-2.5")} text-[var(--text-2)] ${body}`}>
                {screen.lines.slice(0, size === "small" ? 5 : 8).map((l, i) => (
                  <p key={i} className={t(size, "line-clamp-2", "line-clamp-3")}>
                    {l}
                  </p>
                ))}
              </div>
              <span className="sr-only">Reading {screen.site}</span>
            </>
          )}
        </div>
      </Window>
    );
  }

  if (screen.app === "writer") {
    return (
      <Window size={size} address="Reply" icon={<FileText size={ic} className="shrink-0" />}>
        <div className={`flex h-full flex-col justify-end ${pad} ${body}`}>
          <p className="whitespace-pre-wrap text-[var(--text)]">
            {screen.text}
            <span aria-hidden className="screen-caret ml-px inline-block w-[1.5px] translate-y-[2px] bg-[var(--text)]" style={{ height: "1em" }} />
          </p>
        </div>
      </Window>
    );
  }

  const [label, icon] =
    screen.app === "lists"
      ? [screen.action, <ListChecks key="l" size={size === "small" ? 20 : 40} />]
      : screen.app === "routine"
        ? [`Running ${screen.name}`, <AlarmClock key="r" size={size === "small" ? 20 : 40} />]
        : [screen.label, <Sparkles key="s" size={size === "small" ? 20 : 40} />];
  return (
    <Window size={size} address={screen.app === "lists" ? "Lists" : screen.app === "routine" ? "Routines" : "Grid"} loading>
      <div className="grid h-full place-items-center text-center">
        <div className="flex flex-col items-center gap-2 text-[var(--text-2)]">
          <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.4, bounce: 0.3 }} style={{ color: "var(--bot-strong, var(--text))" }}>
            {icon}
          </motion.span>
          <span className={`font-medium text-[var(--text)] ${head}`}>{label}</span>
        </div>
      </div>
    </Window>
  );
}

function Skeleton({ size, rows }: { size: Size; rows: number }) {
  return (
    <div aria-hidden className={`flex flex-col ${t(size, "gap-1.5", "gap-3")}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`rounded-full bg-[var(--surface-2)] ${t(size, "h-1.5", "h-3")}`} style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

function Problem({ size, text }: { size: Size; text: string }) {
  return (
    <div className={`flex items-start gap-1.5 ${t(size, "text-[9.5px]", "text-[14px]")}`}>
      <TriangleAlert size={size === "small" ? 10 : 16} className="mt-0.5 shrink-0 text-[var(--danger)]" />
      <span>{text}</span>
    </div>
  );
}
