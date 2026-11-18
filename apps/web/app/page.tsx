import Link from "next/link";

export default function Home() {
  return (
    <main className="grid h-dvh place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Grid</h1>
        <Link href="/lab" className="text-[var(--text-2)] underline">
          Critter lab
        </Link>
      </div>
    </main>
  );
}
