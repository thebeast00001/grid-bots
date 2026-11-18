"use client";

import { use, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatView } from "@/components/chat/chat-view";
import { useBots } from "@/components/shell/bots-store";
import { api } from "@/lib/api-client";
import { botVars } from "@/lib/critter/palette";

export default function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bots } = useBots();
  const bot = bots?.find((b) => b.id === id);
  const [initial, setInitial] = useState<{ id: string; messages: UIMessage[] } | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ messages: UIMessage[] }>(`/api/bots/${id}/messages`)
      .then((r) => alive && setInitial({ id, messages: r.messages }))
      .catch(() => alive && setInitial({ id, messages: [] }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (bots && !bot) return <div className="grid w-full place-items-center text-[var(--text-2)]">This bot doesn&apos;t exist.</div>;
  if (!bot || initial?.id !== id) return null;

  return (
    <div className="flex w-full" style={botVars(bot.avatar.color)}>
      <ChatView key={bot.id} bot={bot} initial={initial.messages} />
    </div>
  );
}
