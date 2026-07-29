import { cn } from "@/lib/utils";
import { Upload, Briefcase, Bell, KeyRound, CheckCircle } from "lucide-react";

const BASE_STEPS = [
  { id: 1, label: "Resume", icon: Upload },
  { id: 2, label: "Preferences", icon: Briefcase },
  { id: 3, label: "Notifications", icon: Bell },
];
const STEP_0 = { id: 0, label: "Connect", icon: KeyRound };

export function stepsFor(needsByocSetup: boolean) {
  return needsByocSetup ? [STEP_0, ...BASE_STEPS] : BASE_STEPS;
}

export function StepProgress({ step, needsByocSetup }: { step: number; needsByocSetup: boolean }) {
  const steps = stepsFor(needsByocSetup);

  return (
    <div className="flex items-center justify-center mb-8 gap-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors border",
              s.id === step
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
            <span
              className={cn("hidden min-[500px]:block", {
                block: s.id === step,
                hidden: s.id !== step,
              })}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("h-px w-3", step > s.id ? "bg-green-500/40" : "bg-slate-700")} />
          )}
        </div>
      ))}
    </div>
  );
}
