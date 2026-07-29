import { cn } from "@/lib/utils";

/**
 * Renders a job description safely.
 * If the stored content contains HTML tags (from Remotive), it was already
 * server-sanitized via sanitize-html before being stored in the DB.
 * We render it with dangerouslySetInnerHTML and apply prose styles.
 * Plain-text sources (HN, Arbeitnow) are rendered as-is.
 */
export function JobDescription({ text }: { text: string }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(text);

  if (isHtml) {
    return (
      <div
        className="text-xs text-muted-foreground leading-relaxed job-description-prose"
        // Content was sanitized server-side by sanitize-html before DB storage.
        // Only safe tags (p, ul, ol, li, strong, em, h1-h4, a) are allowed.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  return (
    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
  );
}

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
      ? "bg-green-600/15 text-green-700 border-green-600/20 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20"
      : score >= 40
        ? "bg-yellow-600/15 text-yellow-700 border-yellow-600/20 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20"
        : "bg-red-600/15 text-red-700 border-red-600/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border", color)}>
      {score}% · {recommendation ?? "—"}
    </span>
  );
}
