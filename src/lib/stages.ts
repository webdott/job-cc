import { prisma } from "@/lib/prisma";
import { DEFAULT_STAGES, INACTIVE_STAGE_KEYS } from "@/lib/stage-constants";

/** Returns the user's ordered stages, seeding the six defaults on first use. */
export async function getOrSeedStages(userId: string) {
  const existing = await prisma.stage.findMany({
    where: { userId },
    orderBy: { position: "asc" },
  });
  if (existing.length > 0) return existing;

  await prisma.stage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ userId, ...s, position: i })),
    skipDuplicates: true,
  });
  return prisma.stage.findMany({ where: { userId }, orderBy: { position: "asc" } });
}

/** A stage key is valid if it's one of the fixed inactive statuses or an existing Stage row. */
export async function isValidStageKey(userId: string, key: string): Promise<boolean> {
  if ((INACTIVE_STAGE_KEYS as readonly string[]).includes(key)) return true;
  const stage = await prisma.stage.findUnique({ where: { userId_key: { userId, key } } });
  return stage !== null;
}
