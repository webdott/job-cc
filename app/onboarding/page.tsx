"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Upload, Briefcase, Bell, CheckCircle, X, ChevronRight, Loader2 } from "lucide-react";

type WorkType = "Remote" | "Hybrid" | "On-site";

interface Preferences {
  targetRoles: string[];
  locations: string[];
  salaryMin: string;
  salaryMax: string;
  workType: WorkType[];
}

interface ParsedSkill {
  skills?: string[];
  strengthScore?: number;
}

const STEPS = [
  { id: 1, label: "Resume", icon: Upload },
  { id: 2, label: "Preferences", icon: Briefcase },
  { id: 3, label: "Notifications", icon: Bell },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedSkills, setParsedSkills] = useState<string[]>([]);
  const [strengthScore, setStrengthScore] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [prefs, setPrefs] = useState<Preferences>({
    targetRoles: [],
    locations: [],
    salaryMin: "",
    salaryMax: "",
    workType: [],
  });
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

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

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function handleStep1() {
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
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2() {
    setLoading(true);
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      setStep(3);
    } catch {
      setError("Failed to save preferences");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        router.push("/");
        return;
      }

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
    } catch {
      // Fail silently — notifications are optional
    }
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Job<span className="text-blue-500">CC</span>
          </h1>
          <p className="text-muted-foreground text-sm">Set up your command center</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  step === s.id
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : step > s.id
                      ? "bg-green-500/20 text-green-400"
                      : "text-muted-foreground/70"
                )}
              >
                {step > s.id ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <s.icon className="h-3.5 w-3.5" />
                )}
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-6", step > s.id ? "bg-green-500/40" : "bg-slate-700")} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          {/* Step 1 — Resume */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Upload your resume</h2>
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
                      <p className="text-sm text-white font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-3" />
                    <p className="text-sm text-foreground/80">
                      Drop your resume here or click to browse
                    </p>
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
                onClick={handleStep1}
                disabled={loading || !file}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Uploading & parsing…" : "Continue"}
                {!loading && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* Step 2 — Preferences */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Job preferences</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Tell us what you&apos;re looking for.
              </p>

              <div className="space-y-5">
                {/* Target roles */}
                <div>
                  <label className="block text-xs font-medium text-foreground/80 mb-1.5">
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
                    placeholder="e.g. Senior Frontend Engineer — press Enter"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag("targetRoles", roleInput)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Locations */}
                <div>
                  <label className="block text-xs font-medium text-foreground/80 mb-1.5">
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
                    placeholder='e.g. "Remote" or "London" — press Enter'
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag("locations", locationInput)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Salary */}
                <div>
                  <label className="block text-xs font-medium text-foreground/80 mb-1.5">
                    Salary range (USD / year)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="Min"
                      value={prefs.salaryMin}
                      onChange={(e) => setPrefs((p) => ({ ...p, salaryMin: e.target.value }))}
                      className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={prefs.salaryMax}
                      onChange={(e) => setPrefs((p) => ({ ...p, salaryMax: e.target.value }))}
                      className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Work type */}
                <div>
                  <label className="block text-xs font-medium text-foreground/80 mb-1.5">
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
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <button
                onClick={handleStep2}
                disabled={loading}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Saving…" : "Continue"}
                {!loading && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* Step 3 — Notifications */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="h-7 w-7 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Stay in the loop</h2>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Get a daily digest of your top job matches, follow-up reminders, and interview
                alerts — all pushed straight to your device.
              </p>

              <ul className="text-left space-y-2 mb-6">
                {[
                  "📬 Daily job digest every morning",
                  "⏰ Follow-up reminders when you haven't heard back",
                  "🎯 Interview prep reminders",
                  "📊 Weekly application summary",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleEnableNotifications}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-colors mb-3"
              >
                Enable notifications
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full text-muted-foreground/70 hover:text-muted-foreground text-sm py-2 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
