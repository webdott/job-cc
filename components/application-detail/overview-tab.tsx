"use client";

import dynamic from "next/dynamic";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Application, Contact } from "./types";
import { ScoreBadge, timeAgo } from "./shared";
import { useOverviewTab } from "./use-overview-tab";

const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[124px] bg-muted border border-border rounded-xl animate-pulse" />
    ),
  }
);

export function OverviewTab({
  app,
  onUpdate,
}: {
  app: Application;
  onUpdate: (patch: Partial<Application>) => void;
}) {
  const {
    notes,
    contacts,
    noteSaving,
    reminderDate,
    setReminderDate,
    reminderSaving,
    handleNotesChange,
    saveReminder,
    addContact,
    updateContact,
    removeContact,
    saveContacts,
  } = useOverviewTab(app, onUpdate);

  const evaluation = app.job?.evaluation;

  return (
    <div className="flex flex-col gap-5">
      {/* Match analysis */}
      {evaluation && (evaluation.overallScore !== null || evaluation.blockB) && (
        <div className="bg-muted/40 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Match Analysis
            </p>
            <ScoreBadge
              score={evaluation.overallScore ?? null}
              recommendation={evaluation.recommendation ?? null}
            />
          </div>
          {evaluation.blockA?.summary && (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {evaluation.blockA.summary}
            </p>
          )}
          {evaluation.blockB && (
            <div className="grid grid-cols-2 gap-3">
              {(evaluation.blockB.strengths ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-green-400 mb-1.5">Strengths</p>
                  <ul className="space-y-1">
                    {(evaluation.blockB.strengths ?? []).slice(0, 3).map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        ✓ {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(evaluation.blockB.gaps ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-yellow-400 mb-1.5">Gaps</p>
                  <ul className="space-y-1">
                    {(evaluation.blockB.gaps ?? []).slice(0, 3).map((g, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        △ {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Job description */}
      {app.job?.description && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground flex items-center gap-2 list-none">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Job Description
          </summary>
          <div className="mt-2 bg-muted/40 border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-[20]">
              {app.job.description}
            </p>
          </div>
        </details>
      )}

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          {noteSaving && <span className="text-[10px] text-muted-foreground/60">Saving…</span>}
        </div>
        <RichTextEditor
          content={notes}
          onChange={handleNotesChange}
          placeholder="Add notes about this application…"
        />
      </div>

      {/* Follow-up Reminder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Follow-up Reminder</p>
          {reminderSaving && <span className="text-[10px] text-muted-foreground/60">Saving…</span>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={reminderDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setReminderDate(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => void saveReminder(reminderDate)}
            disabled={reminderSaving}
            className="px-3 py-2 text-xs font-medium bg-muted border border-border rounded-xl hover:border-blue-500/50 text-foreground transition-colors disabled:opacity-60"
          >
            Set
          </button>
          {reminderDate && (
            <button
              onClick={() => {
                setReminderDate("");
                void saveReminder("");
              }}
              className="px-3 py-2 text-xs font-medium bg-muted border border-border rounded-xl hover:border-red-500/50 text-muted-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {app.followUpAt && (
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            Reminder set for{" "}
            {new Date(app.followUpAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Contacts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Contacts</p>
          <button
            onClick={addContact}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-2">No contacts added yet.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c: Contact, i: number) => (
              <div key={i} className="bg-muted border border-border rounded-xl p-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    value={c.name}
                    onChange={(e) => updateContact(i, "name", e.target.value)}
                    onBlur={() => void saveContacts()}
                    placeholder="Name"
                    className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    value={c.role ?? ""}
                    onChange={(e) => updateContact(i, "role", e.target.value)}
                    onBlur={() => void saveContacts()}
                    placeholder="Role (e.g. Recruiter)"
                    className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={c.email ?? ""}
                    onChange={(e) => updateContact(i, "email", e.target.value)}
                    onBlur={() => void saveContacts()}
                    placeholder="Email"
                    className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-1">
                    <input
                      value={c.linkedin ?? ""}
                      onChange={(e) => updateContact(i, "linkedin", e.target.value)}
                      onBlur={() => void saveContacts()}
                      placeholder="LinkedIn URL"
                      className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => void removeContact(i)}
                      className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Timeline</p>
        {app.timelineEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-2">No activity yet.</p>
        ) : (
          <div className="relative pl-4 border-l border-border space-y-3">
            {[...app.timelineEvents].reverse().map((event, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[1.15rem] top-1 w-2 h-2 rounded-full bg-muted border border-border" />
                <div>
                  <p className="text-xs text-foreground/80">
                    {event.type === "stage_change"
                      ? `Moved to ${event.stage}`
                      : (event.note ?? event.type)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{timeAgo(event.at)}</p>
                </div>
              </div>
            ))}
            <div className="relative">
              <span className="absolute -left-[1.15rem] top-1 w-2 h-2 rounded-full bg-blue-500" />
              <div>
                <p className="text-xs text-foreground/80">Added to pipeline</p>
                <p className="text-[10px] text-muted-foreground/60">{timeAgo(app.createdAt)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
