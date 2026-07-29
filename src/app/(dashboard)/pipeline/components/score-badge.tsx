import { cn } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
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
