"use client";

export function ManualAdd({
  url,
  onUrlChange,
  onSubmit,
  pending,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <p className="text-sm text-foreground/80 mb-3">Paste a job URL or description</p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="https://company.com/jobs/…"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={onSubmit}
          disabled={!url || pending}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
