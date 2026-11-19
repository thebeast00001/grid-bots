"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import type { BotView } from "@/lib/client-types";

type BotsCtx = {
  bots: BotView[] | null;
  refresh: () => Promise<void>;
  upsert: (b: BotView) => void;
  remove: (id: string) => void;
};

const Ctx = createContext<BotsCtx | null>(null);

/** The bot list, shared by the shell, the Studio and the chat. */
export function BotsProvider({ children }: { children: React.ReactNode }) {
  const [bots, setBots] = useState<BotView[] | null>(null);

  const refresh = useCallback(async () => {
    const r = await api<{ bots: BotView[] }>("/api/bots");
    setBots(r.bots);
  }, []);

  useEffect(() => {
    refresh().catch(() => setBots([]));
  }, [refresh]);

  const upsert = useCallback((b: BotView) => {
    setBots((list) => {
      const rest = (list ?? []).filter((x) => x.id !== b.id);
      const prev = list?.find((x) => x.id === b.id);
      return [{ ...prev, ...b }, ...rest];
    });
  }, []);

  const remove = useCallback((id: string) => setBots((list) => (list ?? []).filter((x) => x.id !== id)), []);

  const value = useMemo(() => ({ bots, refresh, upsert, remove }), [bots, refresh, upsert, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBots(): BotsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBots must be used inside BotsProvider");
  return v;
}
