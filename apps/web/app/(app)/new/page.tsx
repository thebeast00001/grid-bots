"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBots } from "@/components/shell/bots-store";
import { Studio, type BotDraft } from "@/components/studio/studio";
import { api } from "@/lib/api-client";
import type { BotView } from "@/lib/client-types";

const newId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `bot_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
};

export default function NewBot() {
  const router = useRouter();
  const { upsert } = useBots();
  const [botId] = useState(newId);
  // Studio calls create() then onCreated() from one async flow, so hand the bot over in a ref.
  const created = useRef<BotView | null>(null);

  return (
    <Studio
      botId={botId}
      compact={false}
      onCancel={() => router.back()}
      create={async (draft: BotDraft) => {
        created.current = await api<BotView>("/api/bots", { method: "POST", body: JSON.stringify(draft) });
      }}
      onCreated={() => {
        if (created.current) upsert(created.current);
        router.push(`/bots/${botId}`);
      }}
    />
  );
}
