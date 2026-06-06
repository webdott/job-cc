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
} from "lucide-react";

type WorkType = "Remote" | "Hybrid" | "On-site";

interface Preferences {
  targetRoles: string[];
  locations: string[];
  salaryMin: string;
  salaryMax: string;
  workType: WorkType[];
}

interface Resume {
  id: string;
  label: string;
  isActive: boolean;
  strengthScore: number | null;
  createdAt: string;
  parsedData: { skills?: string[] };
}

interface ResumesResponse {
  resumes: Resume[];
}

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
          const data = (await res.json()) as { preferences?: Partial<Preferences> };
          if (data.preferences) {
            setPrefs({
              targetRoles: data.preferences.targetRoles ?? [],
              locations: data.preferences.locations ?? [],
              salaryMin: data.preferences.salaryMin ?? "",
              salaryMax: data.preferences.salaryMax ?? "",
              workType: data.preferences.workType ?? [],
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

  const activeMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/resumes/${id}/active`, { method: "PATCH" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resumes"] }),
  });

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
            resumes.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between bg-muted rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
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
                </div>
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
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upload new */}
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
        <div className="flex items-center justify-between">
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
      </Section>
    </div>
  );
}
