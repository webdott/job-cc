import { useState } from "react";
import type { ParsedSkill } from "../types";

export function useResumeStep(onComplete: () => void) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedSkills, setParsedSkills] = useState<string[]>([]);
  const [strengthScore, setStrengthScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function submit() {
    if (!file) {
      setError("Please upload your resume");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", "My Resume");
      const res = await fetch("/api/resumes", { method: "POST", body: formData });
      if (!res.ok) {
        let message = "Upload failed";
        try {
          const data = (await res.json()) as { error?: string };
          message = data.error ?? message;
        } catch {
          // server returned non-JSON (e.g. HTML error page)
        }
        throw new Error(message);
      }
      const data = (await res.json()) as { parsed?: ParsedSkill };
      setParsedSkills(data.parsed?.skills ?? []);
      setStrengthScore(data.parsed?.strengthScore ?? null);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return {
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
  };
}
