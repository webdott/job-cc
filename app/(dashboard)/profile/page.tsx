import { AccountSection } from "./components/account-section";
import { CredentialsSection } from "./components/credentials-section";
import { ResumesSection } from "./components/resumes-section";
import { JobPreferencesSection } from "./components/job-preferences-section";
import { AppearanceSection } from "./components/appearance-section";
import { NotificationsSection } from "./components/notifications-section";

export default function ProfilePage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Profile</h1>
      <AccountSection />
      <CredentialsSection />
      <ResumesSection />
      <JobPreferencesSection />
      <AppearanceSection />
      <NotificationsSection />
    </div>
  );
}
