"use client";

import { cn } from "@/lib/utils";
import { AI_PROVIDER_OPTIONS, getProviderApiKeyUrl, type AiProviderId } from "@/lib/ai-providers";
import { getDefaultModels } from "@/lib/ai-models";
import { AiModelSelects } from "@/components/ai-model-selects";
import { ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { useByocStep } from "./use-byoc-step";

export function StepConnect({ onComplete }: { onComplete: () => void }) {
  const { byoc, setByoc, byocFieldError, loading, error, submit } = useByocStep(onComplete);

  function setProvider(provider: AiProviderId) {
    const defaults = getDefaultModels(provider);
    setByoc((b) => ({
      ...b,
      aiProvider: provider,
      aiFlashModel: defaults.flash,
      aiProModel: defaults.pro,
    }));
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Connect your credentials</h2>
      <p className="text-muted-foreground text-sm mb-6">
        This instance requires your own AI, storage, and email credentials — nothing is shared with
        the operator. Each is verified with a real test call before continuing.
      </p>

      <div className="space-y-5">
        {/* AI provider */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-1.5">AI provider</label>
          <div className="flex gap-2 mb-2">
            {AI_PROVIDER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setProvider(value)}
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
              "w-full bg-muted border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3",
              byocFieldError === "ai" ? "border-red-500/60" : "border-border"
            )}
          />
          <AiModelSelects
            provider={byoc.aiProvider}
            flashModel={byoc.aiFlashModel}
            proModel={byoc.aiProModel}
            onFlashChange={(id) => setByoc((b) => ({ ...b, aiFlashModel: id }))}
            onProChange={(id) => setByoc((b) => ({ ...b, aiProModel: id }))}
            error={byocFieldError === "ai"}
          />
        </div>

        {/* R2 storage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-foreground/80">
              Cloudflare R2 (resume storage)
            </label>
            <a
              href="https://developers.cloudflare.com/r2/get-started/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
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
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Access key ID"
              value={byoc.r2AccessKeyId}
              onChange={(e) => setByoc((b) => ({ ...b, r2AccessKeyId: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Secret access key"
              value={byoc.r2SecretAccessKey}
              onChange={(e) => setByoc((b) => ({ ...b, r2SecretAccessKey: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Bucket name"
              value={byoc.r2BucketName}
              onChange={(e) => setByoc((b) => ({ ...b, r2BucketName: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Public URL (e.g. https://pub-xxxx.r2.dev)"
              value={byoc.r2PublicUrl}
              onChange={(e) => setByoc((b) => ({ ...b, r2PublicUrl: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Brevo email */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-foreground/80">
              Brevo (email notifications)
            </label>
            <a
              href="https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
            >
              Get a free API key <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Use the verified sender from your Brevo account (usually the email you signed up with).
            It must show as Verified under Senders, domains &amp; IPs.
          </p>
          <div
            className={cn(
              "space-y-2 rounded-lg",
              byocFieldError === "brevo" && "ring-1 ring-red-500/60 p-2 -m-2"
            )}
          >
            <input
              type="password"
              placeholder="API key"
              value={byoc.brevoApiKey}
              onChange={(e) => setByoc((b) => ({ ...b, brevoApiKey: e.target.value }))}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-between gap-2">
              <input
                type="email"
                placeholder="Verified sender email (from)"
                value={byoc.brevoFromEmail}
                onChange={(e) => setByoc((b) => ({ ...b, brevoFromEmail: e.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <a
                href="https://app.brevo.com/senders/domain/ips"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap shrink-0"
              >
                Manage senders <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={
          loading ||
          !byoc.aiApiKey ||
          !byoc.r2AccountId ||
          !byoc.r2AccessKeyId ||
          !byoc.r2SecretAccessKey ||
          !byoc.r2BucketName ||
          !byoc.r2PublicUrl ||
          !byoc.brevoApiKey ||
          !byoc.brevoFromEmail
        }
        className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Verifying…" : "Continue"}
        {!loading && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
