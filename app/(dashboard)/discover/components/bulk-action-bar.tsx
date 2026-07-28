"use client";

import { CheckSquare, Square, Trash2, X } from "lucide-react";

export function BulkActionBar({
  total,
  checkedCount,
  onToggleAll,
  onDelete,
  onClear,
  deletePending,
}: {
  total: number;
  checkedCount: number;
  onToggleAll: () => void;
  onDelete: () => void;
  onClear: () => void;
  deletePending: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <button
        onClick={onToggleAll}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {checkedCount === total && total > 0 ? (
          <CheckSquare className="h-4 w-4 text-blue-400" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        {checkedCount === 0 ? "Select all" : `${checkedCount} selected`}
      </button>
      {checkedCount > 0 && (
        <button
          onClick={onDelete}
          disabled={deletePending}
          className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deletePending ? "Deleting…" : `Delete ${checkedCount}`}
        </button>
      )}
      {checkedCount > 0 && (
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
