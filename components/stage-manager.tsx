"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_COLOR_OPTIONS } from "@/lib/stage-constants";

interface Stage {
  id: string;
  key: string;
  label: string;
  color: string;
  position: number;
}

interface StagesResponse {
  stages: Stage[];
}

export function StageManager({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery<StagesResponse>({
    queryKey: ["stages"],
    queryFn: async () => {
      const res = await fetch("/api/stages");
      return res.json() as Promise<StagesResponse>;
    },
  });
  const stages = data?.stages ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>(STAGE_COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["stages"] });
  }

  async function parseErrorResponse(res: Response, fallback: string) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? fallback;
  }

  const createMutation = useMutation({
    mutationFn: async ({ label, color }: { label: string; color: string }) => {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, color }),
      });
      if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to add stage"));
    },
    onSuccess: () => {
      setNewLabel("");
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; label?: string; color?: string }) => {
      const res = await fetch(`/api/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to update stage"));
    },
    onSuccess: () => {
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to delete stage"));
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await fetch("/api/stages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["stages"] });
      const prev = queryClient.getQueryData<StagesResponse>(["stages"]);
      queryClient.setQueryData<StagesResponse>(["stages"], (old) => {
        if (!old) return old;
        const byId = new Map(old.stages.map((s) => [s.id, s]));
        return {
          stages: ids.map((id, i) => {
            const stage = byId.get(id);
            return stage ? { ...stage, position: i } : stage;
          }),
        } as StagesResponse;
      });
      return { prev };
    },
    onError: (_e, _ids, context) => {
      if (context?.prev) queryClient.setQueryData(["stages"], context.prev);
    },
  });

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderMutation.mutate(ids);
  }

  function startEdit(stage: Stage) {
    setEditingId(stage.id);
    setEditLabel(stage.label);
  }

  function saveEdit(id: string) {
    const trimmed = editLabel.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id, label: trimmed });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-manager-heading"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="relative bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
          <h2 id="stage-manager-heading" className="text-sm font-medium text-foreground">
            Manage stages
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", stage.color)} />
              {editingId === stage.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(stage.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="flex-1 text-sm text-foreground/90 truncate">{stage.label}</span>
              )}

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="p-1 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === stages.length - 1}
                  aria-label="Move down"
                  className="p-1 rounded text-muted-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {editingId === stage.id ? (
                  <button
                    onClick={() => saveEdit(stage.id)}
                    aria-label="Save"
                    className="p-1 rounded text-green-400 hover:text-green-300 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => startEdit(stage)}
                    aria-label="Edit stage"
                    className="p-1 rounded text-muted-foreground/50 hover:text-blue-400 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(stage.id)}
                  disabled={deleteMutation.isPending}
                  aria-label="Delete stage"
                  className="p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new stage */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {STAGE_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={cn(
                  "w-5 h-5 rounded-full",
                  c,
                  newColor === c && "ring-2 ring-offset-2 ring-offset-card ring-foreground/50"
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New stage name"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) {
                  createMutation.mutate({ label: newLabel.trim(), color: newColor });
                }
              }}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() =>
                newLabel.trim() &&
                createMutation.mutate({ label: newLabel.trim(), color: newColor })
              }
              disabled={createMutation.isPending || !newLabel.trim()}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
