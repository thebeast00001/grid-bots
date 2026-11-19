"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { ease } from "@/lib/motion";

/** Bottom sheet for phones: drag down or flick to dismiss (UI.md #8). Wrap in AnimatePresence. */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 flex h-[85dvh] flex-col rounded-t-[28px] bg-[var(--panel)] pb-[env(safe-area-inset-bottom)] edge"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.28, ease: ease.out } }}
        transition={{ duration: 0.45, ease: ease.drawer }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 500) onClose();
        }}
      >
        <div className="grid h-6 shrink-0 place-items-center">
          <span className="h-1 w-10 rounded-full bg-[var(--edge-strong)]" />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </motion.div>
    </div>
  );
}
