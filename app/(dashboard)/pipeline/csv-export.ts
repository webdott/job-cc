import type { Application } from "./types";

function csvField(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function applicationsToCsv(apps: Application[]) {
  const header = [
    "Title",
    "Company",
    "Stage",
    "Location",
    "Remote",
    "Score",
    "Applied Date",
    "Last Activity",
    "Source URL",
  ];
  const rows = apps.map((a) => {
    const title = a.job?.title ?? a.inlineJobData?.title ?? "";
    const company = a.job?.company ?? a.inlineJobData?.company ?? "";
    const score = a.job?.evaluation?.overallScore;
    return [
      title,
      company,
      a.stage,
      a.job?.location ?? "",
      a.job?.remote ? "Yes" : "No",
      score != null ? String(score) : "",
      new Date(a.createdAt).toISOString().slice(0, 10),
      new Date(a.lastActivityAt).toISOString().slice(0, 10),
      a.job?.sourceUrl ?? "",
    ].map(csvField);
  });
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function downloadCsv(apps: Application[]) {
  const blob = new Blob([applicationsToCsv(apps)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pipeline-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
