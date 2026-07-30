import { afterEach, describe, expect, it } from "vitest";
import { buildNotificationEmail, resolveAppUrl } from "@/lib/email-templates";

describe("resolveAppUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("returns absolute URLs unchanged", () => {
    expect(resolveAppUrl("https://example.com/discover")).toBe("https://example.com/discover");
  });

  it("joins relative paths with NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(resolveAppUrl("/discover")).toBe("https://app.example.com/discover");
    expect(resolveAppUrl("pipeline")).toBe("https://app.example.com/pipeline");
  });

  it("returns undefined when relative and no app URL is set", () => {
    expect(resolveAppUrl("/discover")).toBeUndefined();
  });
});

describe("buildNotificationEmail", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("renders a job_match email with escaped content and View matches CTA", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const { textContent, htmlContent } = buildNotificationEmail({
      type: "job_match",
      title: "Job Command Center",
      body: '3 new matches — best: Eng <script> at "Acme"',
      url: "/discover",
    });

    expect(textContent).toContain("3 new matches");
    expect(textContent).toContain("Open in JobCC: https://app.example.com/discover");

    expect(htmlContent).toContain("Job Command Center");
    expect(htmlContent).toContain("View matches");
    expect(htmlContent).toContain('href="https://app.example.com/discover"');
    expect(htmlContent).toContain("Eng &lt;script&gt; at &quot;Acme&quot;");
    expect(htmlContent).not.toContain("<script>");
  });

  it("renders a follow_up_reminder email with Open pipeline CTA", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const { htmlContent } = buildNotificationEmail({
      type: "follow_up_reminder",
      title: "Follow-up Reminder",
      body: "Follow up on Engineer at Acme — no response yet",
      url: "/pipeline",
    });

    expect(htmlContent).toContain("Follow-up Reminder");
    expect(htmlContent).toContain("Open pipeline");
    expect(htmlContent).toContain('href="https://app.example.com/pipeline"');
    expect(htmlContent).toContain("Follow up on Engineer at Acme");
  });

  it("falls back to the type default path when url is omitted", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const jobMatch = buildNotificationEmail({
      type: "job_match",
      title: "Matches",
      body: "You have matches",
    });
    expect(jobMatch.htmlContent).toContain('href="https://app.example.com/discover"');

    const reminder = buildNotificationEmail({
      type: "follow_up_reminder",
      title: "Reminder",
      body: "Follow up",
    });
    expect(reminder.htmlContent).toContain('href="https://app.example.com/pipeline"');
  });
});
