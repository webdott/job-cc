"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  User,
  FileText,
  Bell,
  Palette,
  LogOut,
  CheckCircle,
  Upload,
  Star,
  X,
  Loader2,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Pencil,
  Trash2,
  Briefcase,
  GraduationCap,
} from "lucide-react";

type WorkType = "Remote" | "Hybrid" | "On-site";

interface Preferences {
  targetRoles: string[];
  locations: string[];
  salaryMin: string;
  salaryMax: string;
  workType: WorkType[];
}

interface NotificationPrefs {
  jobMatches: boolean;
  followUpReminders: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  jobMatches: true,
  followUpReminders: true,
  quietHoursStart: "",
  quietHoursEnd: "",
};

interface ParsedExperience {
  title: string;
  company: string;
  duration: string;
  bullets: string[];
}

interface ParsedEducation {
  degree: string;
  institution: string;
  year?: string;
}

interface Resume {
  id: string;
  label: string;
  isActive: boolean;
  strengthScore: number | null;
  createdAt: string;
  parsedData: {
    skills?: string[];
    experience?: ParsedExperience[];
    education?: ParsedEducation[];
  };
}

interface ResumesResponse {
  resumes: Resume[];
}

const MAX_RESUMES = 3;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground/80">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user: clerkUser } = useUser();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [prefs, setPrefs] = useState<Preferences>({
    targetRoles: [],
    locations: [],
    salaryMin: "",
    salaryMax: "",
    workType: [],
  });
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeLabel, setResumeLabel] = useState("My Resume");
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [notifPrefsSaved, setNotifPrefsSaved] = useState(false);

  const { data: resumesData, isLoading: resumesLoading } = useQuery<ResumesResponse>({
    queryKey: ["resumes"],
    queryFn: async () => {
      const res = await fetch("/api/resumes");
      return res.json() as Promise<ResumesResponse>;
    },
  });

  useEffect(() => {
    async function loadPrefs() {
      try {
        const res = await fetch("/api/user/preferences");
        if (res.ok) {
          const data = (await res.json()) as {
            preferences?: Partial<Preferences> & { notifications?: Partial<NotificationPrefs> };
          };
          if (data.preferences) {
            setPrefs({
              targetRoles: data.preferences.targetRoles ?? [],
              locations: data.preferences.locations ?? [],
              salaryMin: data.preferences.salaryMin ?? "",
              salaryMax: data.preferences.salaryMax ?? "",
              workType: data.preferences.workType ?? [],
            });
            setNotifPrefs({
              jobMatches: data.preferences.notifications?.jobMatches ?? true,
              followUpReminders: data.preferences.notifications?.followUpReminders ?? true,
              quietHoursStart: data.preferences.notifications?.quietHoursStart ?? "",
              quietHoursEnd: data.preferences.notifications?.quietHoursEnd ?? "",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadPrefs();
  }, []);

  const prefsMutation = useMutation({
    mutationFn: async (p: Preferences) => {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
    },
    onSuccess: () => {
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    },
  });

  const notifPrefsMutation = useMutation({
    mutationFn: async (p: NotificationPrefs) => {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifications: {
            jobMatches: p.jobMatches,
            followUpReminders: p.followUpReminders,
            quietHoursStart: p.quietHoursStart || null,
            quietHoursEnd: p.quietHoursEnd || null,
          },
        }),
      });
    },
    onSuccess: () => {
      setNotifPrefsSaved(true);
      setTimeout(() => setNotifPrefsSaved(false), 2000);
    },
  });

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

  function addTag(field: "targetRoles" | "locations", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPrefs((p) => ({ ...p, [field]: [...p[field], trimmed] }));
    if (field === "targetRoles") setRoleInput("");
    else setLocationInput("");
  }

  function removeTag(field: "targetRoles" | "locations", val: string) {
    setPrefs((p) => ({ ...p, [field]: p[field].filter((t) => t !== val) }));
  }

  function toggleWorkType(type: WorkType) {
    setPrefs((p) => ({
      ...p,
      workType: p.workType.includes(type)
        ? p.workType.filter((t) => t !== type)
        : [...p.workType, type],
    }));
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

  const resumes = resumesData?.resumes ?? [];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Profile</h1>

      {/* Account */}
      <Section title="Account">
        <div className="flex items-center gap-3 mb-4">
          {clerkUser?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clerkUser.imageUrl} alt="Avatar" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{clerkUser?.fullName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {clerkUser?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
        <SignOutButton>
          <button className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </SignOutButton>
      </Section>

      {/* Resumes */}
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
                                <p className="text-[10px] text-muted-foreground/70">
                                  {exp.duration}
                                </p>
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

      {/* Job Preferences */}
      <Section title="Job Preferences">
        <div className="space-y-4">
          {/* Target roles */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Target job titles
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {prefs.targetRoles.map((r) => (
                <span
                  key={r}
                  className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground/80 text-xs rounded-full"
                >
                  {r}
                  <button onClick={() => removeTag("targetRoles", r)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add a role — press Enter"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag("targetRoles", roleInput)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Locations */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Locations
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {prefs.locations.map((l) => (
                <span
                  key={l}
                  className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground/80 text-xs rounded-full"
                >
                  {l}
                  <button onClick={() => removeTag("locations", l)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add a location — press Enter"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag("locations", locationInput)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Salary */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Salary range (USD / year)
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="Min"
                value={prefs.salaryMin}
                onChange={(e) => setPrefs((p) => ({ ...p, salaryMin: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={prefs.salaryMax}
                onChange={(e) => setPrefs((p) => ({ ...p, salaryMax: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Work type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Work type
            </label>
            <div className="flex gap-2">
              {(["Remote", "Hybrid", "On-site"] as WorkType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleWorkType(type)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    prefs.workType.includes(type)
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                      : "bg-muted border-border text-muted-foreground hover:border-border"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => prefsMutation.mutate(prefs)}
            disabled={prefsMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {prefsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : prefsSaved ? (
              <CheckCircle className="h-4 w-4 text-green-300" />
            ) : null}
            {prefsSaved ? "Saved!" : prefsMutation.isPending ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground/80">Theme</span>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {[
              { value: "light", icon: Sun, label: "Light" },
              { value: "dark", icon: Moon, label: "Dark" },
              { value: "system", icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  theme === value
                    ? "bg-slate-700 text-white"
                    : "text-muted-foreground/70 hover:text-foreground/80"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground/80">Push notifications</span>
          </div>
          <button
            onClick={async () => {
              const permission = await Notification.requestPermission();
              if (permission !== "granted") return;
              const reg = await navigator.serviceWorker.ready;
              const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              });
              const json = sub.toJSON();
              await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
              });
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Enable
          </button>
        </div>

        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/80">Job match alerts</span>
            <button
              onClick={() => setNotifPrefs((p) => ({ ...p, jobMatches: !p.jobMatches }))}
              className={cn(
                "w-9 h-5 rounded-full relative transition-colors shrink-0",
                notifPrefs.jobMatches ? "bg-blue-500" : "bg-muted border border-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  notifPrefs.jobMatches && "translate-x-4"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/80">Follow-up reminders</span>
            <button
              onClick={() =>
                setNotifPrefs((p) => ({ ...p, followUpReminders: !p.followUpReminders }))
              }
              className={cn(
                "w-9 h-5 rounded-full relative transition-colors shrink-0",
                notifPrefs.followUpReminders ? "bg-blue-500" : "bg-muted border border-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  notifPrefs.followUpReminders && "translate-x-4"
                )}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Quiet hours (no push during this window)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={notifPrefs.quietHoursStart}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-muted-foreground/70">to</span>
              <input
                type="time"
                value={notifPrefs.quietHoursEnd}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={() => notifPrefsMutation.mutate(notifPrefs)}
            disabled={notifPrefsMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {notifPrefsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : notifPrefsSaved ? (
              <CheckCircle className="h-4 w-4 text-green-300" />
            ) : null}
            {notifPrefsSaved
              ? "Saved!"
              : notifPrefsMutation.isPending
                ? "Saving…"
                : "Save notification settings"}
          </button>
        </div>
      </Section>
    </div>
  );
}
