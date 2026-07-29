import { useEffect, useState } from "react";

/** Determines the starting step — 0 (Connect) only for non-allowlisted users without saved BYOC credentials, else 1 (Resume). */
export function useOnboarding() {
  const [step, setStep] = useState<number | null>(null);
  const [needsByocSetup, setNeedsByocSetup] = useState(false);

  useEffect(() => {
    async function checkByocSetup() {
      try {
        const res = await fetch("/api/user/me");
        const data = (await res.json()) as { needsByocSetup?: boolean };
        if (data.needsByocSetup) {
          setNeedsByocSetup(true);
          setStep(0);
          return;
        }
      } catch {
        // Fail open — treat as not needing BYOC setup rather than blocking onboarding
      }
      setStep(1);
    }
    checkByocSetup();
  }, []);

  return { step, setStep, needsByocSetup };
}
