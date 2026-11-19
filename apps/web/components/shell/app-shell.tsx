"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutGroup, motion, useDragControls } from "motion/react";
import { Toaster } from "sonner";
import { ease } from "@/lib/motion";
import { usePhone } from "@/lib/use-media";
import { BotList } from "./bot-list";
import { BotsProvider } from "./bots-store";
import { PhoneHome } from "./phone-home";
import { Rail } from "./rail";

/** Phone: the list lives at /bots; a chat or the Studio slides in over it. Swipe from the left edge to go back. */
function PhoneShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const controls = useDragControls();
  if (pathname === "/bots") return <div className="h-dvh">{<PhoneHome />}</div>;
  return (
    <motion.div
      key={pathname}
      className="relative flex h-dvh overflow-hidden bg-[var(--bg)]"
      initial={{ x: "35%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.36, ease: ease.drawer }}
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.9 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > window.innerWidth * 0.3 || info.velocity.x > 500) router.push("/bots");
      }}
    >
      {children}
      <div aria-hidden className="absolute inset-y-0 left-0 z-30 w-4" style={{ touchAction: "none" }} onPointerDown={(e) => controls.start(e)} />
    </motion.div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const phone = usePhone();
  return (
    <BotsProvider>
      <LayoutGroup>
        {phone ? (
          <PhoneShell>{children}</PhoneShell>
        ) : (
          <div className="flex h-dvh w-full overflow-hidden">
            <div className="hidden md:flex">
              <Rail />
              <aside className="edge-r w-[300px] shrink-0 bg-[var(--panel)]">
                <BotList />
              </aside>
            </div>
            <main className="relative flex min-w-0 flex-1">{children}</main>
          </div>
        )}
      </LayoutGroup>
      <Toaster position="bottom-center" toastOptions={{ className: "!rounded-2xl !text-[14px]" }} />
    </BotsProvider>
  );
}
