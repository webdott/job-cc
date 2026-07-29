import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Job<span className="text-blue-500">CC</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your AI-powered job search command center
        </p>
      </div>
      <SignIn />
    </div>
  );
}
