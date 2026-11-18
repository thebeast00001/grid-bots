"use client";

import { useRouter } from "next/navigation";
import { Critter } from "@/components/critter/critter";
import { ConnectModel } from "@/components/models/connect-model";

export default function Welcome() {
  const router = useRouter();
  return (
    <main className="thin-scroll h-dvh overflow-y-auto">
      <div className="mx-auto flex max-w-[520px] flex-col px-4 pb-12 pt-[max(48px,env(safe-area-inset-top))]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Critter cfg={{ shape: "orb", color: 11, eyes: "sparkle", acc: "none", material: "clay" }} size={96} track pettable label="Grid" />
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">Welcome to Grid</h1>
          <p className="mt-1 text-[15px] text-[var(--text-2)]">Connect a model so your bots can think. You can add more later.</p>
        </div>
        <ConnectModel onConnected={() => router.push("/new")} />
      </div>
    </main>
  );
}
