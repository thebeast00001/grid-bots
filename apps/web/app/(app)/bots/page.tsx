"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBots } from "@/components/shell/bots-store";
import { usePhone } from "@/lib/use-media";

/** Phones show the bot list here (rendered by the shell). On desktop the list is the sidebar, so open the latest bot. */
export default function BotsIndex() {
  const phone = usePhone();
  const { bots } = useBots();
  const router = useRouter();
  useEffect(() => {
    if (phone || !bots) return;
    router.replace(bots[0] ? `/bots/${bots[0].id}` : "/new");
  }, [phone, bots, router]);
  return null;
}
