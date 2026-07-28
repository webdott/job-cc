"use client";

import { Loader2 } from "lucide-react";
import { useOnboarding } from "./use-onboarding";
import { StepProgress } from "./components/step-progress";
import { StepConnect } from "./components/step-connect";
import { StepResume } from "./components/step-resume";
import { StepPreferences } from "./components/step-preferences";
import { StepNotifications } from "./components/step-notifications";

export default function OnboardingPage() {
  const { step, setStep, needsByocSetup } = useOnboarding();

  if (step === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
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

        <StepProgress step={step} needsByocSetup={needsByocSetup} />

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6">
          {step === 0 && <StepConnect onComplete={() => setStep(1)} />}
          {step === 1 && <StepResume onComplete={() => setStep(2)} />}
          {step === 2 && <StepPreferences onComplete={() => setStep(3)} />}
          {step === 3 && <StepNotifications />}
        </div>
      </div>
    </div>
  );
}
