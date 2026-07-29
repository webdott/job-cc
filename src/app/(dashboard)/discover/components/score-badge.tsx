import { cn } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground/60">Unscored</span>;
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-semibold",
        score >= 70
          ? "bg-green-600/15 text-green-700 dark:bg-green-500/15 dark:text-green-400"
          : score >= 40
            ? "bg-yellow-600/15 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
            : "bg-red-600/15 text-red-700 dark:bg-red-500/15 dark:text-red-400"
      )}
    >
      {score}%
    </span>
  );
}
