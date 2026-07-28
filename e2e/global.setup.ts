import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test", quiet: true });

import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { prisma } from "@/lib/prisma";

setup.describe.configure({ mode: "serial" });

const authFile = path.join(__dirname, "../playwright/.clerk/user.json");
const testEmail = process.env.E2E_CLERK_USER_EMAIL!;

setup("global setup", async () => {
  await clerkSetup();
});

setup("authenticate, seed an active resume, and save storage state", async ({ page }) => {
  // This test's two goto("/") calls are the very first authenticated hits
  // against `next dev`, which compiles the whole (dashboard) route tree
  // on demand — comfortably under the default 30s locally, but slow
  // enough on CI's shared runners to blow past it. Give it more room.
  setup.setTimeout(90_000);

  // Diagnostics: CI has failed here with no clear cause visible in the
  // default reporter output — surface browser-side errors and every
  // response directly in the CI log instead of only in a downloadable trace.
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[browser console error] ${msg.text()}`);
  });
  page.on("pageerror", (err) => console.log(`[browser page error] ${err.message}`));
  page.on("response", (res) => console.log(`[response] ${res.status()} ${res.url()}`));
  page.on("requestfailed", (req) =>
    console.log(`[request failed] ${req.url()} ${req.failure()?.errorText}`)
  );

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: testEmail });

  // Visiting a protected page triggers the dashboard layout's bootstrap
  // effect (GET /api/user/me), which upserts the app-level User row for
  // this Clerk identity — needed before we can attach a Resume to it below.
  const firstBootstrap = page.waitForResponse((res) => res.url().includes("/api/user/me"));
  await page.goto("/");
  await firstBootstrap;

  const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
  const activeResume = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!activeResume) {
    await prisma.resume.create({
      data: {
        userId: user.id,
        label: "E2E Test Resume",
        fileUrl: "https://example.com/e2e-test-resume.pdf",
        isActive: true,
        parsedData: {
          name: "E2E Test User",
          skills: ["TypeScript", "React", "Node.js"],
          experience: [
            { title: "Software Engineer", company: "Acme", duration: "2022-2026", bullets: [] },
          ],
          education: [],
          strengthScore: 80,
          strengthFeedback: "Solid baseline resume for e2e testing.",
        },
        strengthScore: 80,
      },
    });
  }

  // Reload now that the user has an active resume — the layout should keep
  // us on the dashboard instead of redirecting to /onboarding.
  const secondBootstrap = page.waitForResponse((res) => res.url().includes("/api/user/me"));
  await page.goto("/");
  await secondBootstrap;
  await page.waitForURL("/");
  await page.waitForSelector("text=JobCC");

  await page.context().storageState({ path: authFile });
});
