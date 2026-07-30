import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { acquireLock, releaseLock } from "@/lib/run-lock";
import { listUsersWithQueuedJobs, scoreQueuedForUser, countQueued } from "@/lib/score-queue";
import { triggerScoreDrain } from "@/lib/drain-trigger";
import { POST } from "./route";

// Capture the backgrounded work so tests can await it. Awaiting also asserts it
// never rejects — inside a real `waitUntil` a rejection would be unhandled,
// since the response has already been sent and nothing is left to catch it.
const { backgroundTasks } = vi.hoisted(() => ({ backgroundTasks: [] as Promise<unknown>[] }));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn((p: Promise<unknown>) => {
    backgroundTasks.push(p);
    return p;
  }),
}));

vi.mock("@/lib/run-lock", () => ({
  acquireLock: vi.fn(async (key: string) => ({ key, token: "t" })),
  releaseLock: vi.fn(async () => {}),
}));

vi.mock("@/lib/score-queue", () => ({
  listUsersWithQueuedJobs: vi.fn(async () => []),
  scoreQueuedForUser: vi.fn(async () => ({ scored: 0, failed: 0, deferred: 0, remaining: 0 })),
  countQueued: vi.fn(async () => 0),
}));

vi.mock("@/lib/drain-trigger", () => ({ triggerScoreDrain: vi.fn(async () => true) }));

const mockAcquire = acquireLock as unknown as ReturnType<typeof vi.fn>;
const mockRelease = releaseLock as unknown as ReturnType<typeof vi.fn>;
const mockListUsers = listUsersWithQueuedJobs as unknown as ReturnType<typeof vi.fn>;
const mockScoreUser = scoreQueuedForUser as unknown as ReturnType<typeof vi.fn>;
const mockCountQueued = countQueued as unknown as ReturnType<typeof vi.fn>;
const mockTrigger = triggerScoreDrain as unknown as ReturnType<typeof vi.fn>;

function drainRequest(bearer?: string, depth?: number) {
  const url = `http://localhost/api/internal/score-drain${depth !== undefined ? `?depth=${depth}` : ""}`;
  return new NextRequest(url, {
    method: "POST",
    headers: bearer !== undefined ? { authorization: `Bearer ${bearer}` } : {},
  });
}

/** The handler returns before the drain settles. Rejects if the drain did. */
const flush = () => Promise.all(backgroundTasks);

beforeEach(() => {
  vi.clearAllMocks();
  backgroundTasks.length = 0;
  mockAcquire.mockImplementation(async (key: string) => ({ key, token: "t" }));
  mockRelease.mockResolvedValue(undefined);
  mockListUsers.mockResolvedValue([]);
  mockScoreUser.mockResolvedValue({ scored: 0, failed: 0, deferred: 0, remaining: 0 });
  mockCountQueued.mockResolvedValue(0);
  mockTrigger.mockResolvedValue(true);
});

describe("POST /api/internal/score-drain", () => {
  it("returns 401 without the correct bearer token", async () => {
    const res = await POST(drainRequest("wrong"));
    expect(res.status).toBe(401);
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header is sent", async () => {
    const res = await POST(drainRequest());
    expect(res.status).toBe(401);
  });

  it("returns 202 immediately and drains in the background", async () => {
    mockListUsers.mockResolvedValueOnce(["user-1"]).mockResolvedValue([]);
    mockScoreUser.mockResolvedValue({ scored: 3, failed: 0, deferred: 0, remaining: 0 });

    const res = await POST(drainRequest(process.env.CRON_SECRET));
    expect(res.status).toBe(202);

    await flush();
    expect(mockScoreUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ take: 12 }));
    expect(mockRelease).toHaveBeenCalled();
  });

  it("returns 409 when another drain already holds the lock", async () => {
    mockAcquire.mockResolvedValue(null);

    const res = await POST(drainRequest(process.env.CRON_SECRET));

    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("already-running");
    await flush();
    expect(mockScoreUser).not.toHaveBeenCalled();
  });

  it("refuses to run past the max chain depth", async () => {
    const res = await POST(drainRequest(process.env.CRON_SECRET, 21));
    const body = await res.json();

    expect(body.reason).toBe("max-chain-depth");
    expect(mockAcquire).not.toHaveBeenCalled();
    await flush();
    expect(mockScoreUser).not.toHaveBeenCalled();
  });

  it("stops chaining when a pass makes no progress", async () => {
    // Work remains, but nobody can be scored (all rate limited / no credentials).
    mockListUsers.mockResolvedValue(["user-1"]);
    mockScoreUser.mockResolvedValue({ scored: 0, failed: 0, deferred: 5, remaining: 5 });
    mockCountQueued.mockResolvedValue(5);

    const res = await POST(drainRequest(process.env.CRON_SECRET));
    expect(res.status).toBe(202);

    await flush();
    // One pass, then it gives up rather than spinning or burning chain links.
    expect(mockScoreUser).toHaveBeenCalledTimes(1);
    expect(mockTrigger).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
  });

  it("keeps going when one user throws", async () => {
    mockListUsers.mockResolvedValueOnce(["bad-user", "good-user"]).mockResolvedValue([]);
    mockScoreUser.mockImplementation(async (userId: string) => {
      if (userId === "bad-user") throw new Error("boom");
      return { scored: 1, failed: 0, deferred: 0, remaining: 0 };
    });

    const res = await POST(drainRequest(process.env.CRON_SECRET));
    expect(res.status).toBe(202);

    await flush();
    expect(mockScoreUser).toHaveBeenCalledWith("good-user", expect.anything());
    expect(mockRelease).toHaveBeenCalled();
  });

  it("swallows a drain failure, releases the lock, and does not chain", async () => {
    mockListUsers.mockRejectedValue(new Error("db down"));

    const res = await POST(drainRequest(process.env.CRON_SECRET));
    expect(res.status).toBe(202);

    // Must not reject: this runs inside waitUntil, where nothing can catch it.
    await expect(flush()).resolves.toBeDefined();

    expect(mockRelease).toHaveBeenCalled();
    expect(mockTrigger).not.toHaveBeenCalled();
  });
});
