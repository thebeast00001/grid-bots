"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { ModelInfo, ModelRef, ProviderView } from "@/lib/client-types";

type Group = { provider: ProviderView; models: ModelInfo[]; error?: string };

const encode = (r: ModelRef) => `${r.providerId}::${r.modelId}`;

/** Every model of every connected provider, grouped. A native select: accessible and good on phones. */
export function ModelPicker({
  value,
  onChange,
  label = "Model",
  allowDefault = false,
}: {
  value: ModelRef | null;
  onChange: (v: ModelRef | null) => void;
  label?: string;
  allowDefault?: boolean;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { providers } = await api<{ providers: ProviderView[] }>("/api/providers");
      const loaded = await Promise.all(
        providers.map(async (provider) => {
          try {
            return { provider, models: (await api<{ models: ModelInfo[] }>(`/api/providers/${provider.id}/models`)).models };
          } catch (e) {
            return { provider, models: [], error: e instanceof Error ? e.message : "Unavailable" };
          }
        }),
      );
      if (alive) setGroups(loaded);
    })().catch(() => alive && setGroups([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] text-[var(--text-2)]">{label}</span>
      <select
        aria-label={label}
        value={value ? encode(value) : ""}
        disabled={groups === null}
        onChange={(e) => {
          const [providerId, modelId] = e.target.value.split("::");
          onChange(providerId && modelId ? { providerId, modelId } : null);
        }}
        className="field h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none"
      >
        {groups === null && <option value={value ? encode(value) : ""}>Loading models…</option>}
        {allowDefault && <option value="">Use the default model</option>}
        {!allowDefault && !value && <option value="">Pick a model</option>}
        {groups?.map((g) => (
          <optgroup key={g.provider.id} label={g.error ? `${g.provider.label} (unavailable)` : g.provider.label}>
            {g.models.map((m) => (
              <option key={m.id} value={encode({ providerId: g.provider.id, modelId: m.id })}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
