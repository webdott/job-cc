import { prisma } from "@/lib/prisma";

const TABLES = [
  "PdfExport",
  "CoverLetter",
  "PushSubscription",
  "Notification",
  "InterviewStory",
  "JobEvaluation",
  "Application",
  "Job",
  "Stage",
  "Resume",
  "User",
  "UserCredentials",
];

/**
 * Wipes every app table. Route integration tests call this in a `beforeEach`
 * so each test starts from a clean slate against the real (Docker) test DB.
 * Guards against ever running against something that isn't obviously the
 * throwaway test database, in case `.env.test` wasn't loaded.
 */
export async function resetTestDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/:5433\/|_test\b/.test(url)) {
    throw new Error(
      `Refusing to truncate: DATABASE_URL doesn't look like the test database (${url || "<unset>"}). ` +
        "Did you forget to run `npm run db:test:up` / copy .env.test.example to .env.test?"
    );
  }
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export function createTestUser(
  overrides: Partial<{ clerkId: string; email: string; name: string }> = {}
) {
  return prisma.user.create({
    data: {
      clerkId: overrides.clerkId ?? unique("clerk"),
      email: overrides.email ?? `${unique("user")}@example.com`,
      name: overrides.name ?? "Test User",
    },
  });
}
