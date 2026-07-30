/**
 * Runs `fn` over `items` with at most `limit` in flight at once, preserving
 * input order in the returned array.
 *
 * Scoring is I/O-bound (one Gemini or Claude call per job), so running a handful
 * concurrently costs almost nothing on Fluid compute — active CPU time is what
 * is billed, and waiting on the model doesn't count toward it.
 *
 * There is deliberately no abort mechanism here. Back-pressure is the caller's
 * policy: have `fn` short-circuit and return a "skipped" result when it decides
 * to stop (see lib/score-queue.ts), which keeps this a plain worker pool.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    })
  );

  return results;
}
