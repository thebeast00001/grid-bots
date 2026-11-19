"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Dices, Sparkles } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import { PALETTE, botVars, ok } from "@/lib/critter/palette";
import { SHAPES } from "@/lib/critter/shapes";
import { TEMPLATES } from "@/lib/critter/templates";
import type { AccId, CritterConfig, EyeId, Material, Pose } from "@/lib/critter/types";
import { ease, spring } from "@/lib/motion";

const EYES: EyeId[] = ["dot", "oval", "dash", "sparkle", "wide", "button", "wink", "sleepy", "happy", "line"];
const ACCS: { id: AccId; label: string }[] = [
  { id: "none", label: "Nothing" },
  { id: "glasses", label: "Glasses" },
  { id: "shades", label: "Shades" },
  { id: "headphones", label: "Headphones" },
  { id: "beanie", label: "Beanie" },
  { id: "beret", label: "Beret" },
  { id: "cap", label: "Cap" },
  { id: "crown", label: "Crown" },
  { id: "party", label: "Party hat" },
  { id: "bow", label: "Bow" },
  { id: "bowtie", label: "Bow tie" },
  { id: "leaf", label: "Leaf" },
  { id: "antenna", label: "Antenna" },
  { id: "flower", label: "Flower" },
  { id: "halo", label: "Halo" },
];
const MATERIALS: { id: Material; label: string }[] = [
  { id: "flat", label: "Flat" },
  { id: "clay", label: "Clay" },
  { id: "fuzzy", label: "Fuzzy" },
];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const randomCfg = (): CritterConfig => ({
  shape: pick(SHAPES).id,
  color: Math.floor(Math.random() * PALETTE.length),
  eyes: pick(EYES.filter((e) => e !== "sleepy" && e !== "line")),
  acc: pick(ACCS).id,
  material: pick(MATERIALS).id,
});
const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export type BotDraft = { id: string; name: string; job: string; avatar: CritterConfig };

type Props = {
  botId: string;
  /** Saves the bot. Runs while the wake-up plays; rejecting puts the Studio back in edit mode. */
  create: (draft: BotDraft) => Promise<void>;
  /** Called once the bot exists and the wake-up has played. */
  onCreated: () => void;
  onCancel: () => void;
  compact: boolean;
};

export function Studio({ botId, create, onCreated, onCancel, compact }: Props) {
  const [cfg, setCfg] = useState<CritterConfig>({ shape: "orb", color: 9, eyes: "dot", acc: "none", material: "clay" });
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [previewEyes, setPreviewEyes] = useState<EyeId | undefined>();
  const [pourFrom, setPourFrom] = useState(-1);
  const [pose, setPose] = useState<Pose>("idle");
  const [phase, setPhase] = useState<"edit" | "waking">("edit");
  const [error, setError] = useState<string | null>(null);
  const shuffling = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const set = (p: Partial<CritterConfig>) => setCfg((c) => ({ ...c, ...p }));

  const hop = () => {
    setPose("happy");
    window.setTimeout(() => setPose("idle"), 700);
  };

  const shuffle = () => {
    if (shuffling.current) return;
    shuffling.current = true;
    let i = 0;
    const step = () => {
      setCfg(randomCfg());
      i += 1;
      if (i < 6) window.setTimeout(step, 70);
      else {
        shuffling.current = false;
        hop();
      }
    };
    step();
  };

  const bringToLife = async () => {
    if (!name.trim() || phase !== "edit") return;
    setError(null);
    // Make sure the stage is in view so the wake-up moment is seen.
    const el = scroller.current;
    const scrollWait = el && el.scrollTop > 40 ? 380 : 0;
    el?.scrollTo({ top: 0, behavior: "smooth" });
    setPhase("waking");
    window.setTimeout(() => setPose("asleep"), scrollWait);
    window.setTimeout(() => setPose("happy"), scrollWait + 520);
    try {
      await Promise.all([create({ id: botId, name: name.trim(), job: job.trim(), avatar: cfg }), wait(scrollWait + 1250)]);
      onCreated();
    } catch (e) {
      setPhase("edit");
      setPose("stuck");
      window.setTimeout(() => setPose("idle"), 1100);
      setError(e instanceof Error ? e.message : "Couldn't create the bot. Try again.");
    }
  };

  const size = compact ? 168 : 216;

  return (
    <div className="flex h-full w-full flex-col" style={botVars(cfg.color)}>
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-5">
        <button onClick={onCancel} className="press hover-surface grid size-9 place-items-center rounded-full text-[var(--text-2)]" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[15px] font-semibold">New bot</h1>
      </header>

      <div ref={scroller} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8 md:px-8">
        <div className="mx-auto max-w-[620px]">
          {/* Stage */}
          <div className="dotgrid relative mb-6 grid place-items-center overflow-hidden rounded-[28px] bg-[var(--surface)] edge" style={{ height: size + 70 }}>
            <AnimatePresence>
              {phase === "waking" && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{ background: "radial-gradient(circle at 50% 55%, color-mix(in oklch, var(--bot) 26%, transparent), transparent 62%)" }}
                />
              )}
            </AnimatePresence>
            <motion.div layoutId={`presence-${botId}`} transition={spring.smooth} className="relative">
              <Critter cfg={cfg} size={size} pose={pose} track morph pour pourFrom={pourFrom} pettable eyesOverride={previewEyes} label="Your new bot" />
            </motion.div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={name || "_"}
                initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-4 text-[13px] text-[var(--text-3)]"
              >
                {name ? `@${slug(name) || "bot"}` : "Tap to say hi"}
              </motion.div>
            </AnimatePresence>
          </div>

          <Row label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((s, i) => (
                <button
                  key={s.name}
                  aria-label={s.name}
                  aria-pressed={cfg.color === i}
                  title={s.name}
                  onClick={() => {
                    setPourFrom((i / (PALETTE.length - 1)) * 2 - 1);
                    set({ color: i });
                  }}
                  className="press relative grid size-[32px] place-items-center rounded-full"
                >
                  <span className="size-[26px] rounded-full" style={{ background: `linear-gradient(145deg, ${ok(s, 0.08)}, ${ok(s, -0.06)})` }} />
                  {cfg.color === i && (
                    <motion.span layoutId="swatch-ring" transition={spring.snappy} className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px var(--bg), 0 0 0 4px ${ok(s)}` }} />
                  )}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Shape">
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {SHAPES.map((s) => (
                <Choice key={s.id} active={cfg.shape === s.id} onClick={() => set({ shape: s.id })} label={s.label}>
                  <Critter cfg={{ ...cfg, shape: s.id, acc: "none", material: "flat", eyes: "dot" }} size={34} animated={false} />
                </Choice>
              ))}
            </div>
          </Row>

          <Row label="Eyes">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" onPointerLeave={() => setPreviewEyes(undefined)}>
              {EYES.map((e) => (
                <Choice key={e} active={cfg.eyes === e} onClick={() => set({ eyes: e })} onHover={() => setPreviewEyes(e)} label={`Eyes: ${e}`}>
                  <div className="h-[34px] w-[34px] overflow-hidden">
                    <div className="scale-[2.15]">
                      <Critter cfg={{ ...cfg, shape: "orb", acc: "none", material: "flat", eyes: e }} size={34} animated={false} />
                    </div>
                  </div>
                </Choice>
              ))}
            </div>
          </Row>

          <Row label="Wear">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
              {ACCS.map((a) => (
                <Choice key={a.id} active={cfg.acc === a.id} onClick={() => set({ acc: a.id })} label={a.label}>
                  <Critter cfg={{ ...cfg, acc: a.id, material: "flat" }} size={48} animated={false} />
                </Choice>
              ))}
            </div>
          </Row>

          <Row label="Material">
            <div className="inline-flex rounded-full bg-[var(--surface-2)] p-1" role="radiogroup" aria-label="Material">
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={cfg.material === m.id}
                  onClick={() => set({ material: m.id })}
                  className="press relative rounded-full px-4 py-1.5 text-[13px] font-medium"
                >
                  {cfg.material === m.id && <motion.span layoutId="material-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-[var(--surface)] edge" />}
                  <span className={`relative ${cfg.material === m.id ? "text-[var(--text)]" : "text-[var(--text-2)]"}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </Row>

          <div className="mt-6 grid gap-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && bringToLife()}
                placeholder="Name your bot"
                maxLength={24}
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--text-3)]"
              />
            </Field>
            <Field label="Job">
              <input
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="What should it take care of?"
                maxLength={120}
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--text-3)]"
              />
            </Field>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: ease.out }}
                className="mt-3 text-center text-[13.5px]"
                style={{ color: "oklch(0.6 0.2 25)" }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button onClick={shuffle} className="press hover-surface grid size-11 place-items-center rounded-full bg-[var(--surface)] edge" aria-label="Shuffle look" title="Shuffle look">
              <Dices size={19} />
            </button>
            <button
              onClick={bringToLife}
              disabled={!name.trim() || phase !== "edit"}
              className="press inline-flex h-11 items-center gap-2 rounded-full px-6 text-[15px] font-semibold disabled:opacity-40"
              style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
            >
              <Sparkles size={16} />
              Bring to life
            </button>
          </div>

          <div className="mt-9">
            <div className="mb-3 text-[13px] font-medium text-[var(--text-2)]">Or start from</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setCfg(t.avatar);
                    setName(t.name);
                    setJob(t.job);
                    hop();
                  }}
                  className="press hover-surface flex items-center gap-3 rounded-[20px] bg-[var(--surface)] p-3 text-left edge"
                >
                  <Critter cfg={t.avatar} size={46} label="" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">{t.name}</div>
                    <div className="line-clamp-2 text-[12px] leading-snug text-[var(--text-2)]">{t.job}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[13px] font-medium text-[var(--text-2)]">{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3 edge field">
      <span className="w-11 shrink-0 text-[13px] text-[var(--text-3)]">{label}</span>
      {children}
    </label>
  );
}

function Choice({
  active,
  onClick,
  onHover,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onHover?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      onPointerEnter={onHover}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="press relative grid aspect-square place-items-center rounded-2xl bg-[var(--surface)] edge"
    >
      {active && <span className="absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 0 2px var(--bot)" }} />}
      {children}
    </button>
  );
}
