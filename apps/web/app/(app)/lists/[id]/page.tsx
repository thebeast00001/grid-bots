"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListView } from "@/components/lists/list-view";
import { useList } from "@/components/lists/lists-store";

export default function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const entry = useList(id);
  return (
    <div className="thin-scroll h-dvh w-full overflow-y-auto">
      <div className="mx-auto max-w-[680px] px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))]">
        <nav className="mb-2 flex h-12 items-center">
          <Link href="/lists" className="press hover-surface -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13.5px] text-[var(--text-2)]">
            <ArrowLeft size={16} /> Lists
          </Link>
        </nav>
        {entry === null && <div className="h-40 rounded-2xl bg-[var(--surface)] edge" />}
        {entry === "gone" && <p className="py-10 text-center text-[14px] text-[var(--text-2)]">This list was deleted.</p>}
        {entry && entry !== "gone" && <ListView list={entry} />}
      </div>
    </div>
  );
}
