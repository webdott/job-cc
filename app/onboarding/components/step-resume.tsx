"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, CheckCircle, ChevronRight, Loader2 } from "lucide-react";
import { useResumeStep } from "./use-resume-step";

export function StepResume({ onComplete }: { onComplete: () => void }) {
  const {
    file,
    setFile,
    dragOver,
    setDragOver,
    parsedSkills,
    strengthScore,
    loading,
    error,
    handleFileDrop,
    submit,
  } = useResumeStep(onComplete);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Upload your resume</h2>
      <p className="text-muted-foreground text-sm mb-6">
        PDF or DOCX, up to 5MB. AI will parse it automatically.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          dragOver ? "border-blue-500 bg-blue-500/5" : "border-border hover:border-border",
          file && "border-green-500/50 bg-green-500/5"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <div className="text-left">
              <p className="text-sm text-foreground font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>
        ) : (
          <div>
            <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-3" />
            <p className="text-sm text-foreground/80">Drop your resume here or click to browse</p>
            <p className="text-xs text-muted-foreground/70 mt-1">PDF or DOCX</p>
          </div>
        )}
      </div>

      {/* Parsed skills preview */}
      {parsedSkills.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">Detected skills:</p>
          <div className="flex flex-wrap gap-1.5">
            {parsedSkills.slice(0, 12).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20"
              >
                {skill}
              </span>
            ))}
            {parsedSkills.length > 12 && (
              <span className="px-2 py-0.5 text-muted-foreground/70 text-xs">
                +{parsedSkills.length - 12} more
              </span>
            )}
          </div>
          {strengthScore !== null && (
            <p className="text-xs text-muted-foreground mt-2">
              Resume strength:{" "}
              <span
                className={cn(
                  "font-medium",
                  strengthScore >= 70
                    ? "text-green-400"
                    : strengthScore >= 40
                      ? "text-yellow-400"
                      : "text-red-400"
                )}
              >
                {strengthScore}/100
              </span>
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading || !file}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Uploading & parsing…" : "Continue"}
        {!loading && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
