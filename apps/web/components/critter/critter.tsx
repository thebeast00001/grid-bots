"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { animate, motion, useReducedMotion, useSpring } from "motion/react";
import { POSE_MOTION, bodyTransform, initialMotion, step } from "@/lib/critter/motion";
import { PALETTE, eyeInk, ok, type Swatch } from "@/lib/critter/palette";
import { SHAPE_RADII, geometry, lerpRadii } from "@/lib/critter/shapes";
import type { AccId, CritterConfig, EyeId, Pose } from "@/lib/critter/types";

type Props = {
  cfg: CritterConfig;
  size: number;
  pose?: Pose;
  /** Eyes follow the pointer (desktop, big avatars only). */
  track?: boolean;
  /** Shape changes morph instead of snapping. */
  morph?: boolean;
  /** Colour changes pour in from the side of the picked swatch. */
  pour?: boolean;
  /** -1 = pour from the left, 1 = from the right. */
  pourFrom?: number;
  pettable?: boolean;
  /** false = no breathing, blinking or glancing. */
  animated?: boolean;
  /** Studio hover preview. */
  eyesOverride?: EyeId;
  className?: string;
  label?: string;
};

const EYE_X = 0.36;
const EYE_Y = -0.1;
const INK = "#24222a";
const GOLD = "#f2c14e";
const GOLD_D = "#c9921b";
const HEADWEAR: AccId[] = ["beanie", "beret", "cap", "crown", "party", "leaf", "antenna", "halo"];

const poseEyes = (pose: Pose, eyes: EyeId): EyeId =>
  pose === "asleep" ? "sleepy" : pose === "happy" ? "happy" : pose === "stuck" ? "line" : eyes;

export function Critter({
  cfg,
  size,
  pose = "idle",
  track = false,
  morph = false,
  pour = false,
  pourFrom = -1,
  pettable = false,
  animated = true,
  eyesOverride,
  className = "",
  label,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const petRef = useRef<SVGGElement>(null);
  const blinkRef = useRef<SVGGElement>(null);

  // ── shape (morphs by interpolating radii) ─────────────────────────
  const target = SHAPE_RADII[cfg.shape];
  const [radii, setRadii] = useState<number[]>(target);
  const radiiRef = useRef(radii);
  radiiRef.current = radii;
  useEffect(() => {
    if (!morph || reduce) {
      setRadii(target);
      return;
    }
    const from = radiiRef.current;
    const ctl = animate(0, 1, {
      type: "spring",
      duration: 0.5,
      bounce: 0.22,
      onUpdate: (p) => setRadii(lerpRadii(from, target, p)),
    });
    return () => ctl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.shape]);
  const geo = useMemo(() => geometry(radii), [radii]);

  // ── colour (pours in) ─────────────────────────────────────────────
  const [baseColor, setBaseColor] = useState(cfg.color);
  const [pourKey, setPourKey] = useState(0);
  useEffect(() => {
    if (cfg.color === baseColor) return;
    if (!pour || reduce) setBaseColor(cfg.color);
    else setPourKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.color]);
  const pouring = cfg.color !== baseColor;

  // ── eyes: look direction from pose, pointer, or idle glances ─────
  const lx = useSpring(0, { stiffness: 150, damping: 18, mass: 0.6 });
  const ly = useSpring(0, { stiffness: 150, damping: 18, mass: 0.6 });
  useEffect(() => {
    if (!animated || reduce) {
      lx.set(0);
      ly.set(0);
      return;
    }
    let timer: number | undefined;
    let onMove: ((e: PointerEvent) => void) | undefined;
    if (pose === "thinking") {
      lx.set(-0.07);
      ly.set(-0.075);
    } else if (pose === "working") {
      let dir = 1;
      const scan = () => {
        lx.set(0.075 * dir);
        ly.set(0.03);
        dir *= -1;
        timer = window.setTimeout(scan, 380 + Math.random() * 260);
      };
      scan();
    } else if (pose !== "idle") {
      lx.set(0);
      ly.set(pose === "asleep" ? 0.01 : 0.025);
    } else if (track && size >= 40 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      onMove = (e) => {
        const el = svgRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.48);
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 380);
        lx.set((dx / dist) * k * 0.085);
        ly.set((dy / dist) * k * 0.065);
      };
      window.addEventListener("pointermove", onMove);
    } else {
      const glance = () => {
        const a = Math.random() * Math.PI * 2;
        const k = Math.random() < 0.4 ? 0 : 0.05;
        lx.set(Math.cos(a) * k);
        ly.set(Math.sin(a) * k * 0.7);
        timer = window.setTimeout(glance, 2200 + Math.random() * 3400);
      };
      timer = window.setTimeout(glance, 600 + Math.random() * 2400);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (onMove) window.removeEventListener("pointermove", onMove);
    };
  }, [pose, track, animated, reduce, size, lx, ly]);

  // ── blinking + pause when off-screen ──────────────────────────────
  const visibleRef = useRef(true);
  const poseRef = useRef(pose);
  poseRef.current = pose;

  // ── body motion: big avatars glide between moods (lib/critter/motion.ts) ──
  // Small ones (lists) keep the cheap CSS breathing.
  const breatheRef = useRef<SVGGElement>(null);
  const accRef = useRef<SVGGElement>(null);
  const engine = animated && !reduce && size >= 48;
  useEffect(() => {
    if (!engine) return;
    let state = initialMotion(poseRef.current);
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visibleRef.current && !document.hidden) {
        state = step(state, POSE_MOTION[poseRef.current], dt);
        const t = bodyTransform(state);
        if (breatheRef.current) breatheRef.current.style.transform = `translateY(${t.y}px) rotate(${t.rot}deg) scale(${t.sx}, ${t.sy})`;
        // Accessories ride a little higher, so they seem to float.
        if (accRef.current) accRef.current.style.transform = `translateY(${t.y * 1.35}px) rotate(${t.rot * 0.6}deg)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) el.removeAttribute("data-paused");
      else el.setAttribute("data-paused", "");
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!animated || reduce) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        const el = blinkRef.current;
        if (el && poseRef.current !== "asleep" && visibleRef.current && !document.hidden) {
          el.animate(
            [{ transform: "scaleY(1)" }, { transform: "scaleY(0.08)", offset: 0.45 }, { transform: "scaleY(1)" }],
            { duration: 150, easing: "ease-out" },
          );
        }
        loop();
      }, 2500 + Math.random() * 3500);
    };
    loop();
    return () => clearTimeout(t);
  }, [animated, reduce]);

  // ── petting ───────────────────────────────────────────────────────
  const [petting, setPetting] = useState(false);
  const pet = () => {
    if (!pettable) return;
    petRef.current?.animate(
      [
        { transform: "scale(1,1)" },
        { transform: "scale(1.1,0.88)", offset: 0.22 },
        { transform: "scale(0.94,1.08)", offset: 0.52 },
        { transform: "scale(1.03,0.97)", offset: 0.78 },
        { transform: "scale(1,1)" },
      ],
      { duration: 580, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    setPetting(true);
    window.setTimeout(() => setPetting(false), 900);
  };

  // Offsets the idle bob so critters side by side don't move in lockstep. Derived from
  // useId (same on server and client) rather than Math.random, which broke hydration.
  const delay = useMemo(() => {
    let h = 0;
    for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return -((h % 360) / 100);
  }, [uid]);

  const s = PALETTE[cfg.color] ?? PALETTE[0];
  const base = PALETTE[baseColor] ?? s;
  const material = size < 60 ? "flat" : cfg.material === "fuzzy" && size < 72 ? "clay" : cfg.material;
  const fuzzy = material === "fuzzy";
  const textured = material !== "flat";
  const ink = eyeInk(s);
  const eyeStyle = petting ? "happy" : eyesOverride ?? poseEyes(pose, cfg.eyes);
  const showLeaf = cfg.shape === "sprout" && !HEADWEAR.includes(cfg.acc);
  const A = { top: geo.top, half: geo.half, eyeY: EYE_Y, bottom: geo.bottom };

  return (
    <svg
      ref={svgRef}
      viewBox="-1.6 -1.78 3.2 3.2"
      width={size}
      height={size}
      data-pose={pose}
      data-static={animated && !reduce ? undefined : ""}
      data-engine={engine ? "" : undefined}
      className={`crit ${pettable ? "cursor-pointer" : ""} ${className}`}
      style={{ overflow: "visible", ["--d" as string]: `${delay}s` }}
      role="img"
      aria-label={label}
      onClick={pet}
    >
      <defs>
        <Gradient id={`g${uid}b`} s={base} strong={textured} />
        {pouring && <Gradient id={`g${uid}n`} s={s} strong={textured} />}
        <clipPath id={`c${uid}`}>
          <path d={geo.d} />
        </clipPath>
        {pouring && (
          <clipPath id={`p${uid}`}>
            <motion.circle
              key={pourKey}
              cx={pourFrom * 1.6}
              cy={0.5}
              initial={{ r: 0 }}
              animate={{ r: 3.6 }}
              transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
              onAnimationComplete={() => setBaseColor(cfg.color)}
            />
          </clipPath>
        )}
        {textured && (
          <filter id={`n${uid}`} filterUnits="userSpaceOnUse" x="-2" y="-2.4" width="4" height="4.6">
            <feTurbulence type="fractalNoise" baseFrequency={fuzzy ? 24 : 9} numOctaves={2} seed={4} result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="grey" />
            <feComposite in="grey" in2="SourceGraphic" operator="in" />
          </filter>
        )}
        {fuzzy && (
          <filter id={`f${uid}`} filterUnits="userSpaceOnUse" x="-2.3" y="-2.6" width="4.6" height="5">
            <feTurbulence type="fractalNoise" baseFrequency={15} numOctaves={1} seed={7} result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale={0.12} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        )}
      </defs>

      <g ref={petRef} className="crit-pet">
        <g className="crit-pose">
          <g ref={breatheRef} className="crit-breathe">
            {showLeaf && <Leaf y={A.top + 0.06} />}
            <g filter={fuzzy ? `url(#f${uid})` : undefined}>
              <path d={geo.d} fill={`url(#g${uid}b)`} />
              {pouring && <path d={geo.d} fill={`url(#g${uid}n)`} clipPath={`url(#p${uid})`} />}
              <g clipPath={`url(#c${uid})`}>
                <ellipse
                  cx={-0.36}
                  cy={-0.44}
                  rx={0.34}
                  ry={0.18}
                  transform="rotate(-28 -0.36 -0.44)"
                  fill="#fff"
                  opacity={fuzzy ? 0.16 : textured ? 0.3 : 0.22}
                />
                {textured && (
                  <path
                    d={geo.d}
                    fill="#fff"
                    filter={`url(#n${uid})`}
                    opacity={fuzzy ? 0.5 : 0.18}
                    style={{ mixBlendMode: "overlay" }}
                  />
                )}
              </g>
            </g>

            {size >= 32 && (
              <g opacity={0.32}>
                <ellipse cx={-0.56} cy={EYE_Y + 0.21} rx={0.11} ry={0.06} fill="oklch(0.72 0.16 12)" />
                <ellipse cx={0.56} cy={EYE_Y + 0.21} rx={0.11} ry={0.06} fill="oklch(0.72 0.16 12)" />
              </g>
            )}

            <motion.g style={{ x: lx, y: ly }}>
              <g ref={blinkRef} className="crit-eyes">
                {([-1, 1] as const).map((side) => (
                  <g key={side} transform={`translate(${side * EYE_X} ${EYE_Y}) scale(1.3)`}>
                    <EyeShape id={eyeStyle} side={side} ink={ink} glint={ink !== "#ffffff"} />
                  </g>
                ))}
              </g>
            </motion.g>

            {(pose === "happy" || petting) && (
              <path
                d={`M-0.09 ${EYE_Y + 0.2} Q0 ${EYE_Y + 0.3} 0.09 ${EYE_Y + 0.2}`}
                fill="none"
                stroke={ink}
                strokeWidth={0.036}
                strokeLinecap="round"
              />
            )}
            {pose === "talking" && <ellipse className="crit-mouth" cx={0} cy={EYE_Y + 0.25} rx={0.07} ry={0.055} fill={ink} />}
            {pose === "asleep" && (
              <g className="crit-zzz" fill="var(--text-3)" fontWeight={700}>
                {[0, 1, 2].map((i) => (
                  <text key={i} x={0.5 + i * 0.17} y={A.top + 0.15 - i * 0.22} fontSize={0.22 + i * 0.06} style={{ animationDelay: `${i * 0.7}s` }}>
                    z
                  </text>
                ))}
              </g>
            )}
          </g>
          <g ref={accRef} className="crit-acc">
            <Accessory id={cfg.acc} A={A} s={s} />
          </g>
        </g>
      </g>
    </svg>
  );
}

function Gradient({ id, s, strong }: { id: string; s: Swatch; strong: boolean }) {
  return (
    <linearGradient id={id} x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" style={{ stopColor: ok(s, strong ? 0.13 : 0.08) }} />
      <stop offset="0.55" style={{ stopColor: ok(s) }} />
      <stop offset="1" style={{ stopColor: ok(s, strong ? -0.12 : -0.07) }} />
    </linearGradient>
  );
}

const LEAF = "oklch(0.74 0.17 140)";
const LEAF_D = "oklch(0.55 0.14 140)";

function Leaf({ y }: { y: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path d="M0 0 Q0.02 -0.16 0 -0.27" stroke={LEAF_D} strokeWidth={0.045} fill="none" strokeLinecap="round" />
      <path d="M0 -0.2 Q0.18 -0.44 0.38 -0.31 Q0.21 -0.11 0 -0.2Z" fill={LEAF} />
      <path d="M0 -0.18 Q-0.15 -0.35 -0.3 -0.25 Q-0.15 -0.1 0 -0.18Z" fill={LEAF} />
    </g>
  );
}

function EyeShape({ id, side, ink, glint }: { id: EyeId; side: -1 | 1; ink: string; glint: boolean }) {
  const dotGlint = glint ? <circle cx={0.028} cy={-0.032} r={0.026} fill="#fff" opacity={0.9} /> : null;
  const arc = (d: string) => <path d={d} fill="none" stroke={ink} strokeWidth={0.042} strokeLinecap="round" />;
  switch (id) {
    case "dot":
      return (
        <>
          <circle r={0.085} fill={ink} />
          {dotGlint}
        </>
      );
    case "oval":
      return (
        <>
          <ellipse rx={0.066} ry={0.115} fill={ink} />
          {glint && <ellipse cx={0.022} cy={-0.05} rx={0.02} ry={0.032} fill="#fff" opacity={0.9} />}
        </>
      );
    case "dash":
      return <rect x={-0.032} y={-0.085} width={0.064} height={0.17} rx={0.032} fill={ink} transform={`rotate(${side * 14})`} />;
    case "sparkle":
      return (
        <>
          <circle r={0.1} fill={ink} />
          {glint && (
            <>
              <circle cx={0.034} cy={-0.036} r={0.034} fill="#fff" />
              <circle cx={-0.03} cy={0.036} r={0.016} fill="#fff" opacity={0.85} />
            </>
          )}
        </>
      );
    case "wide":
      return (
        <>
          <circle r={0.125} fill="#fff" stroke={INK} strokeWidth={0.02} />
          <circle r={0.062} fill={INK} />
        </>
      );
    case "button":
      return (
        <>
          <circle r={0.1} fill="none" stroke={ink} strokeWidth={0.03} />
          <circle r={0.052} fill={ink} />
        </>
      );
    case "sleepy":
      return arc("M-0.085 -0.01 Q0 0.07 0.085 -0.01");
    case "happy":
      return arc("M-0.085 0.035 Q0 -0.065 0.085 0.035");
    case "wink":
      return side < 0 ? (
        <>
          <circle r={0.085} fill={ink} />
          {dotGlint}
        </>
      ) : (
        arc("M-0.085 0.035 Q0 -0.065 0.085 0.035")
      );
    case "line":
      return <path d="M-0.08 0 L0.08 0" stroke={ink} strokeWidth={0.04} strokeLinecap="round" />;
  }
}

type Anchors = { top: number; half: number; eyeY: number; bottom: number };

function Accessory({ id, A, s }: { id: AccId; A: Anchors; s: Swatch }) {
  const t = A.top;
  const h2 = (s.h + 180) % 360;
  const comp = `oklch(0.66 0.15 ${h2})`;
  const compD = `oklch(0.52 0.15 ${h2})`;
  const ey = A.eyeY;
  switch (id) {
    case "none":
      return null;
    case "glasses":
      return (
        <g fill="rgba(255,255,255,0.22)" stroke={INK} strokeWidth={0.04}>
          <circle cx={-EYE_X} cy={ey} r={0.175} />
          <circle cx={EYE_X} cy={ey} r={0.175} />
          <path d={`M${-EYE_X + 0.175} ${ey} Q0 ${ey - 0.07} ${EYE_X - 0.175} ${ey}`} fill="none" />
        </g>
      );
    case "shades":
      return (
        <g>
          <rect x={-EYE_X - 0.2} y={ey - 0.12} width={0.4} height={0.25} rx={0.1} fill={INK} />
          <rect x={EYE_X - 0.2} y={ey - 0.12} width={0.4} height={0.25} rx={0.1} fill={INK} />
          <path d={`M${-EYE_X + 0.2} ${ey - 0.06} Q0 ${ey - 0.12} ${EYE_X - 0.2} ${ey - 0.06}`} stroke={INK} strokeWidth={0.05} fill="none" />
          <path d={`M${-EYE_X - 0.1} ${ey - 0.05} l0.08 -0.04 M${EYE_X - 0.1} ${ey - 0.05} l0.08 -0.04`} stroke="#fff" strokeWidth={0.03} strokeLinecap="round" opacity={0.55} />
        </g>
      );
    case "headphones": {
      const w = A.half + 0.03;
      return (
        <g>
          <path d={`M${-w} ${ey + 0.04} C${-w} ${t - 0.38} ${w} ${t - 0.38} ${w} ${ey + 0.04}`} fill="none" stroke={INK} strokeWidth={0.085} strokeLinecap="round" />
          <rect x={-w - 0.11} y={ey - 0.13} width={0.22} height={0.38} rx={0.1} fill={INK} />
          <rect x={w - 0.11} y={ey - 0.13} width={0.22} height={0.38} rx={0.1} fill={INK} />
          <rect x={-w - 0.06} y={ey - 0.06} width={0.12} height={0.24} rx={0.06} fill={comp} />
          <rect x={w - 0.06} y={ey - 0.06} width={0.12} height={0.24} rx={0.06} fill={comp} />
        </g>
      );
    }
    case "beanie":
      return (
        <g>
          <path d={`M-0.66 ${t + 0.36} C-0.66 ${t - 0.32} 0.66 ${t - 0.32} 0.66 ${t + 0.36} Z`} fill={comp} />
          <rect x={-0.71} y={t + 0.22} width={1.42} height={0.19} rx={0.095} fill={compD} />
          <circle cx={0} cy={t - 0.2} r={0.13} fill={compD} />
        </g>
      );
    case "beret":
      return (
        <g transform={`rotate(-12 0 ${t})`}>
          <ellipse cx={0.1} cy={t + 0.03} rx={0.64} ry={0.2} fill={compD} />
          <circle cx={0.12} cy={t - 0.17} r={0.05} fill={compD} />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d={`M-0.58 ${t + 0.3} C-0.58 ${t - 0.28} 0.58 ${t - 0.28} 0.58 ${t + 0.3} Z`} fill={comp} />
          <path d={`M0.3 ${t + 0.22} Q1.05 ${t + 0.16} 1.02 ${t + 0.32} Q0.7 ${t + 0.42} 0.3 ${t + 0.34} Z`} fill={compD} />
          <circle cx={0} cy={t - 0.13} r={0.045} fill={compD} />
        </g>
      );
    case "crown":
      return (
        <g>
          <path
            d={`M-0.4 ${t + 0.14} L-0.46 ${t - 0.3} L-0.2 ${t - 0.08} L0 ${t - 0.4} L0.2 ${t - 0.08} L0.46 ${t - 0.3} L0.4 ${t + 0.14} Z`}
            fill={GOLD}
            stroke={GOLD_D}
            strokeWidth={0.03}
            strokeLinejoin="round"
          />
          <circle cx={0} cy={t + 0.02} r={0.05} fill={comp} />
          <circle cx={-0.46} cy={t - 0.32} r={0.04} fill={GOLD} />
          <circle cx={0} cy={t - 0.42} r={0.04} fill={GOLD} />
          <circle cx={0.46} cy={t - 0.32} r={0.04} fill={GOLD} />
        </g>
      );
    case "party":
      return (
        <g transform={`rotate(-14 0 ${t})`}>
          <path d={`M-0.3 ${t + 0.12} L0 ${t - 0.72} L0.3 ${t + 0.12} Z`} fill={comp} />
          <path d={`M-0.21 ${t - 0.12} L0.23 ${t - 0.06} M-0.11 ${t - 0.4} L0.13 ${t - 0.36}`} stroke="#fff" strokeWidth={0.055} strokeLinecap="round" opacity={0.7} />
          <circle cx={0} cy={t - 0.75} r={0.08} fill={GOLD} />
        </g>
      );
    case "bow":
      return (
        <g transform={`translate(0.42 ${t + 0.16}) rotate(18)`}>
          <path d="M0 0 L-0.24 -0.13 Q-0.29 0 -0.24 0.13 Z" fill={comp} />
          <path d="M0 0 L0.24 -0.13 Q0.29 0 0.24 0.13 Z" fill={comp} />
          <circle r={0.06} fill={compD} />
        </g>
      );
    case "bowtie": {
      const y = Math.min(A.bottom - 0.28, 0.52);
      const fill = s.l < 0.56 ? comp : INK;
      return (
        <g transform={`translate(0 ${y})`}>
          <path d="M0 0 L-0.22 -0.11 Q-0.26 0 -0.22 0.11 Z" fill={fill} />
          <path d="M0 0 L0.22 -0.11 Q0.26 0 0.22 0.11 Z" fill={fill} />
          <rect x={-0.05} y={-0.055} width={0.1} height={0.11} rx={0.03} fill={fill} />
        </g>
      );
    }
    case "leaf":
      return <Leaf y={t + 0.05} />;
    case "antenna":
      return (
        <g>
          <path d={`M0 ${t + 0.04} Q0.04 ${t - 0.2} 0.1 ${t - 0.38}`} stroke={INK} strokeWidth={0.055} fill="none" strokeLinecap="round" />
          <circle cx={0.1} cy={t - 0.42} r={0.08} fill={GOLD} />
        </g>
      );
    case "flower": {
      const petal = `oklch(0.93 0.05 ${(s.h + 40) % 360})`;
      return (
        <g transform={`translate(-0.46 ${t + 0.2})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 0.1} cy={Math.sin((a * Math.PI) / 180) * 0.1} r={0.085} fill={petal} />
          ))}
          <circle r={0.06} fill={GOLD} />
        </g>
      );
    }
    case "halo":
      return <ellipse className="crit-halo" cx={0} cy={t - 0.3} rx={0.4} ry={0.1} fill="none" stroke={GOLD} strokeWidth={0.06} />;
  }
}
