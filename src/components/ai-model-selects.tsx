"use client";

import { cn } from "@/lib/utils";
import {
  getModelOption,
  getModelsForProvider,
  paidTierWarning,
  type AiModelOption,
} from "@/lib/ai-models";
import type { AiProviderId } from "@/lib/ai-providers";

function ModelSelect({
  id,
  label,
  value,
  options,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  options: AiModelOption[];
  onChange: (id: string) => void;
  error?: boolean;
}) {
  const selected = options.find((m) => m.id === value);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-foreground/80 mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full bg-muted border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500",
          error ? "border-red-500/60" : "border-border"
        )}
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
            {!m.freeTier ? " (paid)" : ""}
          </option>
        ))}
      </select>
      {selected && <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>}
    </div>
  );
}

export function AiModelSelects({
  provider,
  flashModel,
  proModel,
  onFlashChange,
  onProChange,
  error,
}: {
  provider: AiProviderId;
  flashModel: string;
  proModel: string;
  onFlashChange: (id: string) => void;
  onProChange: (id: string) => void;
  error?: boolean;
}) {
  const options = getModelsForProvider(provider);
  const flashPaid = getModelOption(provider, flashModel)?.freeTier === false;
  const proPaid = getModelOption(provider, proModel)?.freeTier === false;
  const showPaidWarning = flashPaid || proPaid;

  return (
    <div className="space-y-3">
      <ModelSelect
        id="ai-flash-model"
        label="Scoring & parsing"
        value={flashModel}
        options={options}
        onChange={onFlashChange}
        error={error}
      />
      <ModelSelect
        id="ai-pro-model"
        label="Cover letters"
        value={proModel}
        options={options}
        onChange={onProChange}
        error={error}
      />
      {showPaidWarning && (
        <p className="text-xs text-amber-400/90 bg-amber-500/10 px-3 py-2 rounded-lg">
          {paidTierWarning(provider)}
        </p>
      )}
    </div>
  );
}
