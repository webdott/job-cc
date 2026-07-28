import { cn } from "@/lib/utils";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function coverLetterFileName(company: string | undefined, ext: string) {
  const slug = (company ?? "cover-letter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `cover-letter-${slug || "untitled"}.${ext}`;
}

export function ScoreBadge({
  score,
  recommendation,
}: {
  score: number | null;
  recommendation: string | null;
}) {
  if (score === null) return null;
  const color =
    score >= 70
      ? "bg-green-500/15 text-green-400 border-green-500/20"
      : score >= 40
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
        : "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border", color)}>
      {score}% · {recommendation ?? "—"}
    </span>
  );
}
