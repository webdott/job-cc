"use client";

import { cn } from "@/lib/utils";
import { AI_PROVIDER_OPTIONS, getProviderApiKeyUrl, getProviderLabel } from "@/lib/ai-providers";
import { CheckCircle, Loader2, KeyRound, ExternalLink } from "lucide-react";
import { Section } from "./section";
import { useCredentialsSection } from "./use-credentials-section";

export function CredentialsSection() {
  const { isAllowlisted, credStatus, byoc, setByoc, byocFieldError, byocSaved, byocMutation } =
    useCredentialsSection();

  if (isAllowlisted) return null;

  return (
    <Section title="AI & Storage Credentials">
      {credStatus?.hasCredentials && !byocMutation.isPending && (
        <div className="flex items-center gap-2 mb-4 text-sm text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Connected — using{" "}
          {credStatus.aiProvider ? getProviderLabel(credStatus.aiProvider) : "an AI provider"}.
          Submit below to switch provider or update a revoked key.
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-1.5">AI provider</label>
          <div className="flex gap-2 mb-2">
            {AI_PROVIDER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setByoc((b) => ({ ...b, aiProvider: value }))}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                  byoc.aiProvider === value
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                    : "bg-muted border-border text-muted-foreground hover:border-border"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <a
            href={getProviderApiKeyUrl(byoc.aiProvider)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mb-2"
          >
            Get a free API key <ExternalLink className="h-3 w-3" />
          </a>
          <input
            type="password"
            placeholder="API key"
            value={byoc.aiApiKey}
            onChange={(e) => setByoc((b) => ({ ...b, aiApiKey: e.target.value }))}
            className={cn(
              "w-full bg-muted border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500",
              byocFieldError === "ai" ? "border-red-500/60" : "border-border"
            )}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-foreground/80">
              Cloudflare R2 (resume storage)
            </label>
            <a
              href="https://developers.cloudflare.com/r2/get-started/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Create a bucket <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div
            className={cn(
              "space-y-2 rounded-lg",
              byocFieldError === "r2" && "ring-1 ring-red-500/60 p-2 -m-2"
            )}
          >
            <input
              type="text"
              placeholder="Account ID"
              value={byoc.r2AccountId}
              onChange={(e) => setByoc((b) => ({ ...b, r2AccountId: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Access key ID"
              value={byoc.r2AccessKeyId}
              onChange={(e) => setByoc((b) => ({ ...b, r2AccessKeyId: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Secret access key"
              value={byoc.r2SecretAccessKey}
              onChange={(e) => setByoc((b) => ({ ...b, r2SecretAccessKey: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Bucket name"
              value={byoc.r2BucketName}
              onChange={(e) => setByoc((b) => ({ ...b, r2BucketName: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Public URL (e.g. https://pub-xxxx.r2.dev)"
              value={byoc.r2PublicUrl}
              onChange={(e) => setByoc((b) => ({ ...b, r2PublicUrl: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {byocMutation.isError && (
          <p className="text-red-400 text-sm">{byocMutation.error.message}</p>
        )}

        <button
          onClick={() => byocMutation.mutate(byoc)}
          disabled={
            byocMutation.isPending ||
            !byoc.aiApiKey ||
            !byoc.r2AccountId ||
            !byoc.r2AccessKeyId ||
            !byoc.r2SecretAccessKey ||
            !byoc.r2BucketName ||
            !byoc.r2PublicUrl
          }
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {byocMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : byocSaved ? (
            <CheckCircle className="h-4 w-4 text-green-300" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {byocSaved
            ? "Saved!"
            : byocMutation.isPending
              ? "Verifying…"
              : credStatus?.hasCredentials
                ? "Update credentials"
                : "Save credentials"}
        </button>
      </div>
    </Section>
  );
}
