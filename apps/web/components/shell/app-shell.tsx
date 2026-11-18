"use client";

import { LayoutGroup } from "motion/react";
import { Toaster } from "sonner";
import { BotList } from "./bot-list";
import { BotsProvider } from "./bots-store";
import { Rail } from "./rail";

/** Desktop: rail + bot list + main. The phone layout arrives in Task 12. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BotsProvider>
      <LayoutGroup>
        <div className="flex h-dvh w-full overflow-hidden">
          <div className="hidden md:flex">
            <Rail />
            <aside className="edge-r w-[300px] shrink-0 bg-[var(--panel)]">
              <BotList />
            </aside>
          </div>
          <main className="relative flex min-w-0 flex-1">{children}</main>
        </div>
      </LayoutGroup>
      <Toaster position="bottom-center" toastOptions={{ className: "!rounded-2xl !text-[14px]" }} />
    </BotsProvider>
  );
}
