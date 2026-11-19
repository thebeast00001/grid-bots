import { Critter } from "@/components/critter/critter";

export const metadata = { title: "Offline · Grid" };

export default function Offline() {
  return (
    <main className="grid h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <Critter cfg={{ shape: "orb", color: 11, eyes: "sleepy", acc: "none", material: "clay" }} size={120} pose="asleep" label="Grid" />
        <h1 className="mt-4 text-[22px] font-semibold">You&apos;re offline</h1>
        <p className="mt-1 max-w-[320px] text-[15px] text-[var(--text-2)]">Grid runs on your computer. Start it again (or reconnect) and your bots will be right here.</p>
      </div>
    </main>
  );
}
