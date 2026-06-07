"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  X,
  ExternalLink,
  FileText,
  MessageSquare,
  Briefcase,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  type: string;
  stage?: string;
  note?: string;
  at: string;
}

interface Contact {
  name: string;
  role?: string;
  email?: string;
  linkedin?: string;
}

interface CoverLetterData {
  id: string;
  content: string;
  tone: string;
  versions: { content: string; tone: string; at: string }[];
  updatedAt: string;
}

interface JobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA?: { summary?: string; reason?: string } | null;
  blockB?: { strengths?: string[]; gaps?: string[] } | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  sourceUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  evaluation: JobEvaluation | null;
}

interface Application {
  id: string;
  stage: string;
  notes: string | null;
  contacts: Contact[];
  timelineEvents: TimelineEvent[];
  followUpAt: string | null;
  appliedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  job: Job | null;
  inlineJobData: { title?: string; company?: string } | null;
  coverLetter: CoverLetterData | null;
}

interface ApplicationDetailProps {
  applicationId: string | null;
  onClose: () => void;
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = "overview" | "cover-letter" | "interview-prep";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Briefcase },
  { id: "cover-letter", label: "Cover Letter", icon: FileText },
  { id: "interview-prep", label: "Interview Prep", icon: MessageSquare },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function ScoreBadge({
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

// ── Cover Letter Tab ──────────────────────────────────────────────────────────

function CoverLetterTab({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: CoverLetterData | null;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initial?.content ?? "");
  const [tone, setTone] = useState<"Professional" | "Enthusiastic" | "Concise">("Professional");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState(initial?.versions ?? []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when initial prop changes
  useEffect(() => {
    if (initial) {
      setContent(initial.content);
      setVersions(initial.versions ?? []);
    }
  }, [initial]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const generate = useCallback(async () => {
    setStreaming(true);
    setContent("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setContent(full);
      }

      // Invalidate so the parent gets the new cover letter
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    } catch (e) {
      console.error(e);
    } finally {
      setStreaming(false);
    }
  }, [applicationId, tone, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/applications/${applicationId}/cover-letter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      return res.json();
    },
  });

  const copy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-border">
          {(["Professional", "Enthusiastic", "Concise"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                tone === t
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => void generate()}
          disabled={streaming}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ml-auto"
        >
          <Sparkles className={cn("h-3.5 w-3.5", streaming && "animate-pulse")} />
          {streaming ? "Generating…" : content ? "Regenerate" : "Generate"}
        </button>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={streaming ? "" : "Click Generate to create your cover letter…"}
          rows={12}
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground/50 resize-none focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
        />
        {streaming && (
          <div className="absolute bottom-3 right-3">
            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse rounded-sm" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs",
              wordCount === 0
                ? "text-muted-foreground/50"
                : wordCount < 200 || wordCount > 350
                  ? "text-yellow-400"
                  : "text-green-400"
            )}
          >
            {wordCount} words{" "}
            {wordCount > 0 &&
              (wordCount < 200 ? "(too short)" : wordCount > 350 ? "(too long)" : "✓")}
          </span>
          {versions.length > 0 && (
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="text-xs text-muted-foreground/70 hover:text-foreground flex items-center gap-1"
            >
              {versions.length} version{versions.length !== 1 ? "s" : ""}
              {showVersions ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {content && (
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          {content && !streaming && (
            <button
              onClick={() => saveMutation.mutate(content)}
              disabled={saveMutation.isPending}
              className="text-xs bg-muted border border-border hover:border-blue-500/50 text-foreground px-3 py-1.5 rounded-lg transition-colors"
            >
              {saveMutation.isPending ? "Saving…" : "Save edits"}
            </button>
          )}
        </div>
      </div>

      {/* Version history */}
      {showVersions && versions.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Version history</p>
          </div>
          <div className="divide-y divide-border">
            {[...versions].reverse().map((v, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground/70">
                    {formatDate(v.at)} · {v.tone}
                  </span>
                  <button
                    onClick={() => setContent(v.content)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Restore
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{v.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interview Prep Tab ────────────────────────────────────────────────────────

interface InterviewPrepData {
  questions: { category: string; question: string; hint: string }[];
  keyThemes: string[];
  redFlags: string[];
}

function InterviewPrepTab({ applicationId }: { applicationId: string }) {
  const [prep, setPrep] = useState<InterviewPrepData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/interview-prep`, {
        method: "POST",
      });
      const data = (await res.json()) as { prep: InterviewPrepData };
      setPrep(data.prep);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const categoryColor: Record<string, string> = {
    Behavioural: "bg-purple-500/15 text-purple-400",
    Technical: "bg-blue-500/15 text-blue-400",
    Situational: "bg-yellow-500/15 text-yellow-400",
    Culture: "bg-green-500/15 text-green-400",
    "Role-specific": "bg-orange-500/15 text-orange-400",
  };

  if (!prep) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground/80 mb-1">Interview Prep</p>
          <p className="text-xs text-muted-foreground">
            AI generates likely questions based on the job description and your resume.
          </p>
        </div>
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Sparkles className={cn("h-4 w-4", loading && "animate-pulse")} />
          {loading ? "Generating…" : "Generate prep"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Regenerate */}
      <div className="flex justify-end">
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Regenerate
        </button>
      </div>

      {/* Key themes */}
      <div className="bg-muted/50 border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Key Interview Themes</p>
        <div className="flex flex-wrap gap-1.5">
          {prep.keyThemes.map((theme, i) => (
            <span
              key={i}
              className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20"
            >
              {theme}
            </span>
          ))}
        </div>
      </div>

      {/* Red flags */}
      {prep.redFlags.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
            <p className="text-xs font-medium text-yellow-400">Prepare for these gaps</p>
          </div>
          <ul className="space-y-1">
            {prep.redFlags.map((flag, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                • {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-2">
        {prep.questions.map((q, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-start gap-3 p-3 text-left"
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                  categoryColor[q.category] ?? "bg-muted text-muted-foreground"
                )}
              >
                {q.category}
              </span>
              <p className="text-sm text-foreground/90 flex-1">{q.question}</p>
              {expanded === i ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </button>
            {expanded === i && (
              <div className="px-3 pb-3 pt-0">
                <div className="bg-muted/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">💡 {q.hint}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  app,
  onUpdate,
}: {
  app: Application;
  onUpdate: (patch: Partial<Application>) => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(app.notes ?? "");
  const [contacts, setContacts] = useState<Contact[]>(app.contacts ?? []);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteTimer, setNoteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sync if app prop changes
  useEffect(() => {
    setNotes(app.notes ?? "");
    setContacts(app.contacts ?? []);
  }, [app.id, app.notes, app.contacts]);

  const patchApp = useCallback(
    async (patch: object) => {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { application: Application };
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      onUpdate(data.application);
      return data.application;
    },
    [app.id, queryClient, onUpdate]
  );

  // Debounced notes save
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (noteTimer) clearTimeout(noteTimer);
    const t = setTimeout(async () => {
      setNoteSaving(true);
      try {
        await patchApp({ notes: value });
      } finally {
        setNoteSaving(false);
      }
    }, 1000);
    setNoteTimer(t);
  };

  const addContact = () => {
    const newContacts = [...contacts, { name: "", role: "", email: "", linkedin: "" }];
    setContacts(newContacts);
  };

  const updateContact = (i: number, field: keyof Contact, value: string) => {
    const updated = contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c));
    setContacts(updated);
  };

  const removeContact = async (i: number) => {
    const updated = contacts.filter((_, idx) => idx !== i);
    setContacts(updated);
    await patchApp({ contacts: updated });
  };

  const saveContacts = async () => {
    await patchApp({ contacts });
  };

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
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this application…"
          rows={4}
          className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 resize-none focus:outline-none focus:border-blue-500 transition-colors"
        />
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
            {contacts.map((c, i) => (
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

// ── Main component ────────────────────────────────────────────────────────────

export function ApplicationDetail({ applicationId, onClose }: ApplicationDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [appData, setAppData] = useState<Application | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}`);
      return res.json() as Promise<{ application: Application }>;
    },
    enabled: !!applicationId,
  });

  useEffect(() => {
    if (data?.application) setAppData(data.application);
  }, [data]);

  // Reset tab when switching applications
  useEffect(() => {
    setTab("overview");
  }, [applicationId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!applicationId) return null;

  const app = appData ?? data?.application ?? null;
  const jobTitle = app?.job?.title ?? app?.inlineJobData?.title ?? "Untitled Role";
  const company = app?.job?.company ?? app?.inlineJobData?.company ?? "Unknown Company";

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          // Mobile: bottom sheet
          "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl max-h-[90vh] flex flex-col",
          // Desktop: right side panel
          "md:relative md:bottom-auto md:left-auto md:right-auto md:rounded-none md:border-t-0 md:border-l md:max-h-none md:h-full md:w-[420px] md:shrink-0",
          "transition-all duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            {isLoading ? (
              <div className="space-y-1.5">
                <div className="h-4 bg-muted rounded w-40 animate-pulse" />
                <div className="h-3 bg-muted rounded w-24 animate-pulse" />
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-sm text-foreground truncate">{jobTitle}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{company}</p>
                  {app?.job?.sourceUrl && (
                    <a
                      href={app.job.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {app && (
                  <div className="mt-1.5">
                    <ScoreBadge
                      score={app.job?.evaluation?.overallScore ?? null}
                      recommendation={app.job?.evaluation?.recommendation ?? null}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
                tab === id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading || !app ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <OverviewTab
                  app={app}
                  onUpdate={(patch) => setAppData((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
              )}
              {tab === "cover-letter" && (
                <CoverLetterTab applicationId={app.id} initial={app.coverLetter} />
              )}
              {tab === "interview-prep" && <InterviewPrepTab applicationId={app.id} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
