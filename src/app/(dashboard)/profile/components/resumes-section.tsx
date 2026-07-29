"use client";

import { cn } from "@/lib/utils";
import {
  FileText,
  Star,
  CheckCircle,
  Trash2,
  ChevronDown,
  Pencil,
  X,
  Briefcase,
  GraduationCap,
  Upload,
  Loader2,
} from "lucide-react";
import { Section } from "./section";
import { useResumesSection } from "./use-resumes-section";
import { MAX_RESUMES } from "../types";

export function ResumesSection() {
  const {
    resumes,
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
  } = useResumesSection();

  return (
    <Section title="Resumes">
      <div className="space-y-2 mb-4">
        {resumesLoading ? (
          <div className="h-14 bg-muted rounded-lg animate-pulse" />
        ) : resumes.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">No resumes uploaded yet.</p>
        ) : (
          resumes.map((r) => {
            const expanded = expandedResumeId === r.id;
            const editing = editingResumeId === r.id;
            const skills = editing ? editSkills : (r.parsedData.skills ?? []);
            return (
              <div key={r.id} className="bg-muted rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <button
                    onClick={() => setExpandedResumeId(expanded ? null : r.id)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{r.label}</p>
                      {r.strengthScore !== null && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="h-2.5 w-2.5 text-yellow-400" />
                          <span className="text-[10px] text-muted-foreground">
                            Strength {r.strengthScore}/100
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/60 shrink-0 transition-transform ml-auto mr-2",
                        expanded && "rotate-180"
                      )}
                    />
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.isActive ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => activeMutation.mutate(r.id)}
                        className="text-[10px] text-muted-foreground/70 hover:text-blue-400 transition-colors"
                      >
                        Set active
                      </button>
                    )}
                    <button
                      onClick={() => deleteResumeMutation.mutate(r.id)}
                      disabled={deleteResumeMutation.isPending}
                      title="Delete resume"
                      className="p-1 rounded text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-3 pb-3 border-t border-border/60 pt-3 space-y-3">
                    {/* Skills */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Skills</p>
                        {editing ? (
                          <button
                            onClick={() =>
                              updateResumeMutation.mutate({ id: r.id, skills: editSkills })
                            }
                            disabled={updateResumeMutation.isPending}
                            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {updateResumeMutation.isPending ? "Saving…" : "Save"}
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditingSkills(r)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-blue-400 transition-colors"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                            Edit
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {skills.length === 0 && (
                          <p className="text-xs text-muted-foreground/50">No skills parsed.</p>
                        )}
                        {skills.map((s) => (
                          <span
                            key={s}
                            className="flex items-center gap-1 px-2 py-0.5 bg-background border border-border text-foreground/80 text-xs rounded-full"
                          >
                            {s}
                            {editing && (
                              <button onClick={() => removeSkill(s)}>
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {editing && (
                        <input
                          type="text"
                          placeholder="Add a skill — press Enter"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addSkill()}
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>

                    {/* Experience timeline */}
                    {(r.parsedData.experience?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          <Briefcase className="h-3 w-3" />
                          Experience
                        </p>
                        <div className="space-y-2 border-l border-border pl-3">
                          {r.parsedData.experience?.map((exp, i) => (
                            <div key={i}>
                              <p className="text-xs text-foreground/90">
                                {exp.title} · {exp.company}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70">{exp.duration}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education */}
                    {(r.parsedData.education?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          <GraduationCap className="h-3 w-3" />
                          Education
                        </p>
                        <div className="space-y-1">
                          {r.parsedData.education?.map((edu, i) => (
                            <p key={i} className="text-xs text-foreground/80">
                              {edu.degree} · {edu.institution}
                              {edu.year ? ` (${edu.year})` : ""}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {deleteError && <p className="text-xs text-red-400 mb-3">{deleteError}</p>}

      {/* Upload new */}
      {resumes.length >= MAX_RESUMES ? (
        <p className="text-xs text-muted-foreground/70">
          You&apos;ve reached the limit of {MAX_RESUMES} resumes. Delete one to upload another.
        </p>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Label (e.g. Engineering)"
            value={resumeLabel}
            onChange={(e) => setResumeLabel(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
          />
          <label
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
              uploadingResume
                ? "bg-slate-700 text-muted-foreground"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            )}
          >
            {uploadingResume ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadingResume ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={uploadingResume}
            />
          </label>
        </div>
      )}
    </Section>
  );
}
