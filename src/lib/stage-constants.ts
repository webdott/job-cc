// Client-safe stage constants — no server/Prisma imports, so this can be
// used from "use client" components as well as API routes.

// Terminal statuses shown in the Pipeline's collapsible "Inactive" panel.
// Fixed and distinct from the user-customizable Stage table: these represent
// an application's outcome, not a Kanban column the user organizes.
export const INACTIVE_STAGE_KEYS = ["Ghosted", "Withdrawn", "Archived"] as const;

export const INACTIVE_STAGES = [
  { key: "Ghosted", label: "Ghosted", color: "bg-zinc-500" },
  { key: "Withdrawn", label: "Withdrawn", color: "bg-orange-500" },
  { key: "Archived", label: "Archived", color: "bg-neutral-500" },
] as const;

export const DEFAULT_STAGES = [
  { key: "Saved", label: "Saved", color: "bg-slate-500" },
  { key: "Applied", label: "Applied", color: "bg-blue-500" },
  { key: "Screening", label: "Screening", color: "bg-yellow-500" },
  { key: "Interview", label: "Interview", color: "bg-purple-500" },
  { key: "Offer", label: "Offer", color: "bg-green-500" },
  { key: "Rejected", label: "Rejected", color: "bg-red-500" },
] as const;

// Palette offered when creating/recoloring a custom stage.
export const STAGE_COLOR_OPTIONS = [
  "bg-slate-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
] as const;
