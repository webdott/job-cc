-- Custom Kanban stages per user (issue #1).
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-slate-500',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stage_userId_key_key" ON "Stage"("userId", "key");
CREATE INDEX "Stage_userId_position_idx" ON "Stage"("userId", "position");

ALTER TABLE "Stage" ADD CONSTRAINT "Stage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same RLS posture as every other table: service-role only, no anon/browser access.
ALTER TABLE "Stage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON "Stage" USING (false);
