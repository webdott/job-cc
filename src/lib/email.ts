export interface EmailCredentials {
  apiKey: string;
  fromEmail: string;
}

interface SendTransactionalEmailInput extends EmailCredentials {
  toEmail: string;
  subject: string;
  textContent: string;
  /** Absolute or app-relative URL included in the plain-text body when present. */
  url?: string;
}

/**
 * Confirms the Brevo API key works and that `fromEmail` is an active verified sender.
 */
export async function verifyBrevoCredentials(apiKey: string, fromEmail: string): Promise<void> {
  const accountRes = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  if (!accountRes.ok) {
    throw new Error(`Brevo account check failed (${accountRes.status})`);
  }

  const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  if (!sendersRes.ok) {
    throw new Error(`Brevo senders check failed (${sendersRes.status})`);
  }

  const data = (await sendersRes.json()) as {
    senders?: Array<{ email?: string; active?: boolean }>;
  };
  const normalized = fromEmail.trim().toLowerCase();
  const match = data.senders?.find(
    (s) => s.email?.trim().toLowerCase() === normalized && s.active !== false
  );
  if (!match) {
    throw new Error("Sender email is not a verified Brevo sender on this account");
  }
}

export async function sendTransactionalEmail({
  apiKey,
  fromEmail,
  toEmail,
  subject,
  textContent,
  url,
}: SendTransactionalEmailInput): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const absoluteUrl =
    url && (url.startsWith("http://") || url.startsWith("https://"))
      ? url
      : url && appUrl
        ? `${appUrl}${url.startsWith("/") ? url : `/${url}`}`
        : undefined;

  const bodyText = absoluteUrl ? `${textContent}\n\nOpen in JobCC: ${absoluteUrl}` : textContent;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Job Command Center", email: fromEmail },
      to: [{ email: toEmail }],
      subject,
      textContent: bodyText,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail}`);
  }
}
