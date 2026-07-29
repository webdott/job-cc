import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Resume, ResumesResponse } from "../types";

export function useResumesSection() {
  const queryClient = useQueryClient();

  const { data: resumesData, isLoading: resumesLoading } = useQuery<ResumesResponse>({
    queryKey: ["resumes"],
    queryFn: async () => {
      const res = await fetch("/api/resumes");
      return res.json() as Promise<ResumesResponse>;
    },
  });

  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeLabel, setResumeLabel] = useState("My Resume");
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/resumes/${id}/active`, { method: "PATCH" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resumes"] }),
  });

  const updateResumeMutation = useMutation({
    mutationFn: async ({ id, skills }: { id: string; skills: string[] }) => {
      await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setEditingResumeId(null);
    },
  });

  const deleteResumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to delete resume");
      }
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  function startEditingSkills(resume: Resume) {
    setEditingResumeId(resume.id);
    setEditSkills(resume.parsedData.skills ?? []);
    setSkillInput("");
  }

  function addSkill() {
    const trimmed = skillInput.trim();
    if (!trimmed || editSkills.includes(trimmed)) return;
    setEditSkills((s) => [...s, trimmed]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setEditSkills((s) => s.filter((sk) => sk !== skill));
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", resumeLabel);
      await fetch("/api/resumes", { method: "POST", body: formData });
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  }

  return {
    resumes: resumesData?.resumes ?? [],
    resumesLoading,
    uploadingResume,
    resumeLabel,
    setResumeLabel,
    expandedResumeId,
    setExpandedResumeId,
    editingResumeId,
    editSkills,
    skillInput,
    setSkillInput,
    deleteError,
    activeMutation,
    updateResumeMutation,
    deleteResumeMutation,
    startEditingSkills,
    addSkill,
    removeSkill,
    handleResumeUpload,
  };
}
