import { Toaster } from "sonner";

/** Settings pages sit outside the app shell, so they bring their own place for toasts. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-center" toastOptions={{ className: "!rounded-2xl !text-[14px]" }} />
    </>
  );
}
