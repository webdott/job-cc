"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Copy, Check, ChevronDown, ChevronUp, Sparkles, Download } from "lucide-react";
import type { CoverLetterData } from "./types";
import { downloadBlob, coverLetterFileName, formatDate } from "./shared";

export function CoverLetterTab({
  applicationId,
  initial,
  company,
}: {
  applicationId: string;
  initial: CoverLetterData | null;
  company?: string;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initial?.content ?? "");
  const [tone, setTone] = useState<"Professional" | "Enthusiastic" | "Concise">("Professional");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
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

  const downloadTxt = () => {
    downloadBlob(new Blob([content], { type: "text/plain" }), coverLetterFileName(company, "txt"));
    setShowDownloadMenu(false);
  };

  const downloadDocx = async () => {
    const { Document, Packer, Paragraph } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: content.split(/\n+/).map((line) => new Paragraph(line)),
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, coverLetterFileName(company, "docx"));
    setShowDownloadMenu(false);
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
          {content && (
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
              {showDownloadMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                    <button
                      onClick={downloadTxt}
                      className="block w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      As .txt
                    </button>
                    <button
                      onClick={() => void downloadDocx()}
                      className="block w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                    >
                      As .docx
                    </button>
                  </div>
                </>
              )}
            </div>
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
