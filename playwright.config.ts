import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test", quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    // "on-first-retry" never fires with retries: 0 (the default) — CI has
    // never had a real trace to inspect a single e2e failure with.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    // /sign-in specifically, not baseURL — `/` 404s for unauthenticated
    // requests (Clerk's auth.protect() default with no redirect configured,
    // same in production), so the readiness probe needs a route that's
    // always public.
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Env vars from .env.test (loaded above) are inherited via process.env —
    // deliberately NOT setting NODE_ENV here. next-pwa's disable check is
    // `NODE_ENV === "development"` exactly, so anything else (e.g. "test")
    // flips the PWA/Workbox plugin on even under `next dev`, and it was
    // regenerating the service worker on every compile, starving the dev
    // server from ever becoming ready for Playwright's health check.
  },
  projects: [
    {
      name: "global setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "e2e",
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["global setup"],
    },
  ],
});
