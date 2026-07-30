import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "@/lib/email";

describe("sendTransactionalEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("includes htmlContent in the Brevo payload when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await sendTransactionalEmail({
      apiKey: "key",
      fromEmail: "from@example.com",
      toEmail: "to@example.com",
      subject: "Hello",
      textContent: "plain body",
      htmlContent: "<p>html body</p>",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as {
      textContent: string;
      htmlContent?: string;
      subject: string;
    };
    expect(payload.subject).toBe("Hello");
    expect(payload.textContent).toBe("plain body");
    expect(payload.htmlContent).toBe("<p>html body</p>");
  });

  it("omits htmlContent from the payload when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await sendTransactionalEmail({
      apiKey: "key",
      fromEmail: "from@example.com",
      toEmail: "to@example.com",
      subject: "Hello",
      textContent: "plain body",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload.textContent).toBe("plain body");
    expect(payload).not.toHaveProperty("htmlContent");
  });
});
