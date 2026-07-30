"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { AccountSection } from "./components/account-section";
import { AiModelsSection } from "./components/ai-models-section";
import { CredentialsSection } from "./components/credentials-section";
import { ResumesSection } from "./components/resumes-section";
import { JobPreferencesSection } from "./components/job-preferences-section";
import { AppearanceSection } from "./components/appearance-section";
import { NotificationsSection } from "./components/notifications-section";

export default function ProfilePage() {
  const queryClient = useQueryClient();

  return (
    <PullToRefresh className="h-full" onRefresh={() => queryClient.invalidateQueries()}>
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <h1 className="text-xl font-semibold mb-6">Profile</h1>
        <AccountSection />
        <AiModelsSection />
        <CredentialsSection />
        <ResumesSection />
        <JobPreferencesSection />
        <AppearanceSection />
        <NotificationsSection />
      </div>
    </PullToRefresh>
  );
}
