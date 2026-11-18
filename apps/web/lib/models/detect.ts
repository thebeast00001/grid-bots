async function answers(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Finds local model servers running on their default ports. */
export async function detectLocal(): Promise<{ ollama: boolean; lmstudio: boolean }> {
  const [ollama, lmstudio] = await Promise.all([
    answers("http://127.0.0.1:11434/api/tags"),
    answers("http://127.0.0.1:1234/v1/models"),
  ]);
  return { ollama, lmstudio };
}
