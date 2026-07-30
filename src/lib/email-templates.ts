export type EmailNotificationType = "job_match" | "follow_up_reminder";

export interface NotificationEmailContent {
  textContent: string;
  htmlContent: string;
}

const CTA_LABEL: Record<EmailNotificationType, string> = {
  job_match: "View matches",
  follow_up_reminder: "Open pipeline",
};

const DEFAULT_PATH: Record<EmailNotificationType, string> = {
  job_match: "/discover",
  follow_up_reminder: "/pipeline",
};

/** Resolves an app-relative or absolute URL against NEXT_PUBLIC_APP_URL. */
export function resolveAppUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  if (!appUrl) return undefined;
  return `${appUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlLayout(opts: {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl?: string;
}): string {
  const headline = escapeHtml(opts.headline);
  const body = escapeHtml(opts.body);
  const ctaLabel = escapeHtml(opts.ctaLabel);
  const ctaUrl = opts.ctaUrl ? escapeHtml(opts.ctaUrl) : undefined;

  const ctaBlock = ctaUrl
    ? `
                  <tr>
                    <td align="center" style="padding:28px 0 8px;">
                      <a href="${ctaUrl}"
                         style="display:inline-block;background-color:#3b82f6;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:14px 28px;border-radius:8px;">
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>`
    : "";

  const linkFallback = ctaUrl
    ? `
                  <tr>
                    <td style="padding:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
                      Or open: <a href="${ctaUrl}" style="color:#3b82f6;text-decoration:underline;">${ctaUrl}</a>
                    </td>
                  </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f0e8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">
              Job Command Center
            </td>
          </tr>
          <tr>
            <td style="background-color:#fffcf7;border:1px solid #e8dcc8;border-radius:12px;padding:32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;line-height:1.3;color:#0f172a;">
                    ${headline}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#334155;">
                    ${body}
                  </td>
                </tr>
                ${ctaBlock}
                ${linkFallback}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
              You’re receiving this because notifications are enabled in your Job Command Center profile.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds plain-text + HTML bodies for a notification email.
 * In-app / push copy stays separate — callers pass the same title/body used there.
 */
export function buildNotificationEmail(input: {
  type: EmailNotificationType;
  title: string;
  body: string;
  url?: string;
}): NotificationEmailContent {
  const ctaUrl = resolveAppUrl(input.url ?? DEFAULT_PATH[input.type]);
  const ctaLabel = CTA_LABEL[input.type];

  const textContent = ctaUrl ? `${input.body}\n\nOpen in JobCC: ${ctaUrl}` : input.body;

  const htmlContent = buildHtmlLayout({
    headline: input.title,
    body: input.body,
    ctaLabel,
    ctaUrl,
  });

  return { textContent, htmlContent };
}
