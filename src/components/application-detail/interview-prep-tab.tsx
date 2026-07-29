"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface InterviewPrepData {
  questions: { category: string; question: string; hint: string }[];
  keyThemes: string[];
  redFlags: string[];
}

const CATEGORY_COLOR: Record<string, string> = {
  Behavioural: "bg-purple-500/15 text-purple-400",
  Technical: "bg-blue-500/15 text-blue-400",
  Situational: "bg-yellow-500/15 text-yellow-400",
  Culture: "bg-green-500/15 text-green-400",
  "Role-specific": "bg-orange-500/15 text-orange-400",
};

export function InterviewPrepTab({ applicationId }: { applicationId: string }) {
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
                  CATEGORY_COLOR[q.category] ?? "bg-muted text-muted-foreground"
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
