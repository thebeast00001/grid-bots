/** Required by OpenAI's Sign in with ChatGPT guidelines, shown near the composer. */
export function ChatgptBadge() {
  return (
    <div className="flex items-center justify-center gap-1.5 text-[12px] text-[var(--text-3)]">
      <span>Using ChatGPT plan</span>
      <span aria-hidden>·</span>
      <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer" className="underline">
        Manage usage
      </a>
    </div>
  );
}
