"use client";

import { useEffect, useState } from "react";
import { Critter } from "@/components/critter/critter";
import { SHAPES } from "@/lib/critter/shapes";
import type { AccId, EyeId, Material, Pose } from "@/lib/critter/types";

const ACCS: AccId[] = ["glasses", "headphones", "beanie", "beret", "cap", "crown", "party", "bow", "bowtie", "antenna", "flower", "halo"];
const EYES: EyeId[] = ["dot", "oval", "dash", "sparkle", "wide", "button", "wink", "dot", "oval", "sparkle", "dash", "dot"];
const POSES: Pose[] = ["idle", "thinking", "working", "waiting", "happy", "stuck", "asleep", "talking"];

/** Critter test sheet: every shape, accessory, material and pose. */
export default function Lab() {
  const [mounted, setMounted] = useState(false);
  const [material, setMaterial] = useState<Material>("clay");
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <main className="h-full overflow-auto p-8 thin-scroll">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Critter lab</h1>
        {(["flat", "clay", "fuzzy"] as Material[]).map((m) => (
          <button key={m} onClick={() => setMaterial(m)} className="press rounded-full px-3 py-1 text-sm edge" style={{ background: m === material ? "var(--surface-3)" : "var(--surface)" }}>
            {m}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-6">
        {SHAPES.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center gap-2 rounded-3xl bg-[var(--surface)] p-4 edge">
            <Critter cfg={{ shape: s.id, color: i % 16, eyes: EYES[i], acc: ACCS[i], material }} size={140} track pettable />
            <span className="text-sm text-[var(--text-2)]">
              {s.label} · {ACCS[i]}
            </span>
          </div>
        ))}
      </div>
      <h2 className="mb-4 mt-10 text-lg font-semibold">Poses</h2>
      <div className="grid grid-cols-8 gap-4">
        {POSES.map((p) => (
          <div key={p} className="flex flex-col items-center gap-2 rounded-3xl bg-[var(--surface)] p-4 edge">
            <Critter cfg={{ shape: "orb", color: 11, eyes: "dot", acc: "none", material }} size={100} pose={p} />
            <span className="text-sm text-[var(--text-2)]">{p}</span>
          </div>
        ))}
      </div>
      <h2 className="mb-4 mt-10 text-lg font-semibold">Small sizes</h2>
      <div className="flex items-end gap-4">
        {[20, 28, 36, 48, 64, 96].map((sz) => (
          <Critter key={sz} cfg={{ shape: "cloud", color: 9, eyes: "dot", acc: "headphones", material }} size={sz} />
        ))}
      </div>
    </main>
  );
}
